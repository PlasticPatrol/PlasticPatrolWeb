// @ts-nocheck
"use strict";

import _ from "lodash";
import { Parser as Json2CsvParser } from "json2csv";
import * as functions from "firebase-functions";
import mkdirp from "mkdirp-promise";
import corsModule from "cors";
import { PubSub } from "@google-cloud/pubsub";
import path from "path";
import os from "os";
import fs from "fs";
import gmModule from "gm";
import express from "express";
import admin from "firebase-admin";

import { firestore } from "./firestore";
import { STATS_TOPIC } from "./constants";
import config from "./config.json";
import { updateStats, computeStatsAdHoc } from "./stats";
import { barcodeLookup } from "./barcodeLookup";

import * as missions from "./missions";

const cors = corsModule({ origin: true });
const gm = gmModule.subClass({ imageMagick: true });

const THUMB_MAX_SIZE = 50;
const THUMB_NAME = "thumbnail.jpg";

const MAIN_MAX_SIZE = 1014;
const MAIN_NAME = "1024.jpg";

const DB_CACHE_AGE_MS = 1000 * 60 * 60 * 24 * 1; // 1 day
const WEB_CACHE_AGE_S = 1 * 60 * 60 * 24 * 1; // 1day

// const DB_CACHE_AGE_MS = 0; // none
// const WEB_CACHE_AGE_S =    0; // noce

const pubsub = new PubSub();
const app = express();
app.use(cors);

async function resize(inFile, outFile, maxSize) {
  return new Promise((resolve, reject) => {
    gm(inFile)
      .resize(maxSize, maxSize)
      .write(outFile, (err) => {
        if (err) reject(err);
        else resolve();
      });
  });
}

/**
 * It publish a message indicating to recalculate the stats if the data doesn't have the field "updated".
 *
 * @param doc "/sys/stats" doc coming from firebase
 *
 * @returns {Promise<boolean>}
 */
async function pubIfNecessary(doc) {
  let recalculate = true;

  try {
    const updatedTimestamp = doc.data().updated.toDate().getTime();
    const age = new Date().getTime() - updatedTimestamp;
    recalculate = age > DB_CACHE_AGE_MS;
    console.info(`States is ${age / 1000 / 60 / 60} hours old`);
  } catch (e) {
    console.info("states is corrupted. It will be re calculated: ", e);
  }

  if (recalculate) {
    console.info("Need to recreate stats");

    try {
      await pubsub.createTopic(STATS_TOPIC);
    } catch (e) {
      console.info(`topic already created: ${e}`);
    }

    const messageId = await pubsub
      .topic(STATS_TOPIC)
      .publish(Buffer.from("Recreate the stats"));
    console.info(`Message ${messageId} published.`);
  }

  return true;
}

/**
 * When an image is uploaded in the Storage bucket We generate a thumbnail automatically using
 * ImageMagick.
 * After the thumbnail has been generated and uploaded to Cloud Storage,
 * we write the public URL to the Firebase Realtime Database.
 */
const generateThumbnail = functions.storage
  .object()
  .onFinalize(async (object) => {
    // File and directory paths.
    const filePath = object.name;
    const contentType = object.contentType; // This is the image MIME type
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const thumbFilePath = path.normalize(path.join(fileDir, `${THUMB_NAME}`));
    const mainFilePath = path.normalize(path.join(fileDir, `${MAIN_NAME}`));
    const tempLocalFile = path.join(os.tmpdir(), filePath);
    const tempLocalDir = path.dirname(tempLocalFile);
    const tempLocalThumbFile = path.join(os.tmpdir(), thumbFilePath);
    const tempLocalMainFile = path.join(os.tmpdir(), mainFilePath);

    // Exit if this is triggered on a file that is not an image.
    if (!contentType.startsWith("image/")) {
      return console.info("This is not an image.", filePath);
    }

    // Exit if the image is already a thumbnail.
    if (fileName !== "original.jpg") {
      return console.info(
        `I won't create a thumbnail for ${filePath} as it is not called "original.jpg"`
      );
    }

    // Cloud Storage files.
    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(filePath);

    const metadata = {
      contentType: contentType,
      // To enable Client-side caching you can set the Cache-Control headers here. Uncomment below.
      "Cache-Control": "public,max-age=3600"
    };

    // Create the temp directory where the storage file will be downloaded.
    await mkdirp(tempLocalDir);
    // Download file from bucket.
    await file.download({ destination: tempLocalFile });
    console.info("The file has been downloaded to", tempLocalFile);
    // Generate a thumbnail using ImageMagick.
    await resize(tempLocalFile, tempLocalThumbFile, THUMB_MAX_SIZE);
    console.info("Thumbnail created at", tempLocalThumbFile);
    await resize(tempLocalFile, tempLocalMainFile, MAIN_MAX_SIZE);
    console.info("Main created at", tempLocalMainFile);

    // Uploading the Thumbnail.
    const uploadThumb = bucket
      .upload(tempLocalThumbFile, {
        destination: thumbFilePath,
        metadata: metadata
      })
      .then(() => bucket.makePublic());
    const uploadMain = bucket
      .upload(tempLocalMainFile, {
        destination: mainFilePath,
        metadata: metadata
      })
      .then(() => bucket.makePublic());

    await Promise.all([uploadMain, uploadThumb]);
    console.info("Thumbnail uploaded to Storage at", thumbFilePath);
    console.info("Main uploaded to Storage at", mainFilePath);

    // Once the image has been uploaded delete the local files to free up disk space.
    fs.unlinkSync(tempLocalFile);
    fs.unlinkSync(tempLocalThumbFile);
    fs.unlinkSync(tempLocalMainFile);

    return console.info(`Photos are public now`);
  });

app.get("/stats", async (req, res) => {
  if (req.method !== "GET") {
    return res.status(403).send("Forbidden!");
  }

  res.set(
    "Cache-Control",
    `public, max-age=${WEB_CACHE_AGE_S}, s-maxage=${WEB_CACHE_AGE_S * 2}`
  );

  try {
    const doc = await firestore.collection("sys").doc("stats").get();
    if (doc.exists) {
      const data = doc.data();
      data.updated = data.updated.toDate();
      data.serverTime = new Date();
      res.json(data);
      await pubIfNecessary(doc);
      return true;
    } else {
      throw new Error("/sys/stats doesn't exist");
    }
  } catch (e) {
    console.info(e);
    return res.status(503).send("stats not ready yet");
  }
});

function convertFirebaseTimestampFieldsIntoDate(photo) {
  const newPhoto = _.cloneDeep(photo);
  _.forEach(newPhoto, (value, field) => {
    if (value.constructor.name === "Timestamp") {
      newPhoto[field] = value.toDate();
    }
  });
  return newPhoto;
}

app.get("/photos.json", async (req, res) => {
  if (req.method !== "GET") {
    return res.status(403).send("Forbidden!");
  }

  res.set(
    "Cache-Control",
    `public, max-age=${WEB_CACHE_AGE_S}, s-maxage=${WEB_CACHE_AGE_S * 2}`
  );

  const querySnapshot = await firestore
    .collection("photos")
    .where("published", "==", true)
    .get();
  const data = {
    photos: {},
    serverTime: new Date()
  };
  querySnapshot.forEach((doc) => {
    // doc.data() is never undefined for query doc snapshots
    data.photos[doc.id] = convertFirebaseTimestampFieldsIntoDate(doc.data());
  });

  res.json(data);
  return true;
});

function plainToFlattenObject(object) {
  const result = {};

  function flatten(obj, prefix = "") {
    _.forEach(obj, (value, key) => {
      if (_.isObject(value)) {
        flatten(value, `${prefix}${key}.`);
      } else {
        result[`${prefix}${key}`] = value;
      }
    });
  }

  flatten(JSON.parse(JSON.stringify(object)));

  return result;
}

app.get("/photos.csv", async (req, res) => {
  if (req.method !== "GET") {
    return res.status(403).send("Forbidden!");
  }

  res.set(
    "Cache-Control",
    `public, max-age=${WEB_CACHE_AGE_S}, s-maxage=${WEB_CACHE_AGE_S * 2}`
  );

  const querySnapshot = await firestore
    .collection("photos")
    .where("published", "==", true)
    .get();
  const photos = [];
  querySnapshot.forEach((doc) => {
    const photo = convertFirebaseTimestampFieldsIntoDate(doc.data());
    const newPhoto = plainToFlattenObject(_.extend(photo, { id: doc.id }));

    photos.push(newPhoto);
  });

  const parser = new Json2CsvParser();

  let csv = "?";
  try {
    csv = parser.parse(photos);
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
    return false;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="' + "photos-" + Date.now() + '.csv"'
  );
  res.status(200).send(csv);
  return true;
});

async function hostMetadata(req, res) {
  const BUCKET = config.FIREBASE.storageBucket;
  const SERVER_URL = config.metadata.serverUrl;
  const TW_SITE = config.metadata.twSite;
  const TW_CREATOR = config.metadata.twCreator;
  const TW_DOMAIN = config.metadata.twDomain;

  const paramsStr = req.url.substr(1);
  const params = paramsStr.split("@");
  const photoId = params[0];

  let photo;
  if (photoId.length > 0) {
    photo = await firestore.collection("photos").doc(photoId).get();
  }

  let indexHTML;
  if (photo && photo.exists && photo.data().published) {
    const TW_DESCRIPTION = config.metadata.twDescriptionField
      ? photo.data()[config.metadata.twDescriptionField]
      : config.metadata.twDescription;
    const TW_TITLE = config.metadata.twTitle;
    const TW_IMAGE = `https://storage.googleapis.com/${BUCKET}/photos/${photoId}/1024.jpg`;
    const TW_IMAGE_ALT = TW_DESCRIPTION;

    indexHTML = `
      <html>
        <meta http-equiv="refresh" content="0; URL='${SERVER_URL}/#/photos/${paramsStr}'" />
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:site" content="${TW_SITE}">
        <meta name="twitter:title" content="${TW_TITLE}">
        <meta name="twitter:description" content="${TW_DESCRIPTION}">
        <meta name="twitter:creator" content="${TW_CREATOR}">
        <meta name="twitter:image:src" content="${TW_IMAGE}">
        <meta name="twitter:image:alt" content="${TW_IMAGE_ALT}" />
        <meta name="twitter:domain" content="${TW_DOMAIN}">
        <body> <!-- ${JSON.stringify(photo.data())} --> </body>
      </html>
    `;
  } else {
    indexHTML = `
      <html>
        <meta http-equiv="refresh" content="0; URL='${SERVER_URL}'" />
        <body>
            Nothing here
         </body>
      </html>
    `;
  }

  res.status(200).send(indexHTML);
}

const wrap = (f) => {
  const wrapped = async (req, res) => {
    try {
      const result = await f(req);
      res.status(200).send(result);
    } catch (e) {
      res.status(500).send({ error: "" + e });
    }
  };
  return wrapped;
};

module.exports = {
  api: functions.https.onRequest(app),
  hostMetadata: functions.https.onRequest(hostMetadata),
  generateThumbnail,
  updateStats: functions.pubsub.topic(STATS_TOPIC).onPublish(updateStats),
  computeStats: functions.https.onRequest(wrap(computeStatsAdHoc)),
  barcodeLookup: functions.https.onCall(barcodeLookup),
  createMission: missions.create,
  joinMission: missions.join,
  leaveMission: missions.leave,
  rejectNewMemberMission: missions.rejectNewMember,
  approveNewMemberMission: missions.approveNewMember,
  fetchMission: missions.fetch,
  updateMissionOnPhotoEdit: missions.updateMissionOnPhotoEdit,
  updateMissionOnPhotoUpload: missions.updateMissionOnPhotoUpload
};
