// @ts-nocheck
import firebase from "firebase/app";
import _ from "lodash";

import * as localforage from "localforage";

import { firebaseApp } from "./firebaseInit.js";
import firebaseConfig from "./config";
import Stats from "types/Stats";
import Feature from "types/Feature";
import { Feedback } from "types/Feedback";
import Photo from "types/Photo";
import Config from "types/Config";
import { updateMissionOnPhotoModerated } from "./missions";
import User from "../../types/User";

const firestore = firebase.firestore();
export const storageRef = firebase.storage().ref();
const MAX_NUMBER_OF_FEEDBACKS_TO_FETCH = 50;

// TODO: add caching

function extractPhoto(data, id): Photo {
  const prefix = `https://storage.googleapis.com/${storageRef.location.bucket}/photos/${id}`;

  // some data from Firebase cannot be stringified into json, so we need to convert it into other format first.
  const photo = _.mapValues(data, (fieldValue, fieldKey, doc) => {
    if (fieldValue instanceof firebase.firestore.DocumentReference) {
      return fieldValue.path;
    } else {
      return fieldValue;
    }
  });

  photo.thumbnail = `${prefix}/thumbnail.jpg`;
  photo.main = `${prefix}/1024.jpg`;
  photo.id = id;

  photo.updated =
    photo.updated instanceof firebase.firestore.Timestamp
      ? photo.updated.toDate()
      : new Date(photo.updated);
  photo.moderated =
    photo.moderated instanceof firebase.firestore.Timestamp
      ? photo.moderated.toDate()
      : photo.moderated === null
      ? undefined
      : new Date(photo.moderated);

  // when comming from json, it looses the type
  if (!(photo.location instanceof firebase.firestore.GeoPoint)) {
    photo.location = new firebase.firestore.GeoPoint(
      Number(photo.location._latitude) || 0,
      Number(photo.location._longitude) || 0
    );
  }

  // old photos might not have the categories field set, so just set it
  // to an empty list so the rest of the application can assume the field
  // is there
  if (photo.categories === undefined) {
    photo.categories = [];
  }

  return photo;
}

export type RealtimeUpdate = {
  type: "added" | "modified" | "removed";
  photo: Photo;
};

function ownPhotosRT(
  ownerId: string,
  onUpdate: (update: RealtimeUpdate) => void
): () => void {
  const callback = onChange(onUpdate);
  return firestore
    .collection("photos")
    .where("published", "==", true)
    .where("owner_id", "==", ownerId)
    .orderBy("moderated", "desc")
    .onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach(callback);
      },
      (e) => {
        console.error(
          "failed to subscribe to realtime updates for my photos: %s",
          e
        );
      }
    );
}

const onChange = (onUpdate: (udpate: RealtimeUpdate) => void) => {
  return (change) => {
    var photo;
    try {
      photo = extractPhoto(change.doc.data(), change.doc.id);
    } catch (e) {
      console.error(`the document with ID ${change.doc.id} is malformed`);
      return;
    }
    if (change.type === "added") {
      onUpdate({ type: change.type, photo });
    } else if (change.type === "modified") {
      onUpdate({ type: change.type, photo });
    } else if (change.type === "removed") {
      onUpdate({ type: change.type, photo });
    } else {
      console.error(`the photo ${photo.id} as type ${change.type}`);
    }
  };
};

const configObserver = (
  onNext: (config: Config) => void,
  onError = undefined
) => {
  localforage.getItem("config").then(onNext).catch(console.log);

  return firestore
    .collection("sys")
    .doc("config")
    .onSnapshot((snapshot) => {
      const config = snapshot.data();
      localforage.setItem("config", config);
      onNext(config as Config);
    }, onError);
};

async function fetchStats(): Promise<Stats> {
  const response = await fetch(firebaseConfig.apiURL + "/stats", {
    mode: "cors"
  });
  const json = await response.json();
  return json;
}

export interface ProductInfo {
  brand: string;
  productName: string;
  barcode: number;
}

async function getBarcodeInfo(id: number): Promise<ProductInfo | undefined> {
  const barcodeLookup = firebase.functions().httpsCallable("barcodeLookup");
  const { data } = await barcodeLookup({ id });
  if (data === null) {
    return undefined;
  } else {
    return { ...data, barcode: id };
  }
}

async function fetchPhotos(): Promise<Photo[]> {
  const photosResponse = await fetch(firebaseConfig.apiURL + "/photos.json", {
    mode: "cors"
  });
  const photosJson = await photosResponse.json();
  const photos = photosJson.photos;

  return _.map(photos, (data, id) => extractPhoto(data, id));
}

async function fetchFeedbacks(): Promise<Array<Feedback>> {
  const query = firestore
    .collection("feedbacks")
    .orderBy("updated", "desc")
    .limit(MAX_NUMBER_OF_FEEDBACKS_TO_FETCH);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

function saveMetadata(data) {
  data.location = new firebase.firestore.GeoPoint(
    Number(data.latitude) || 0,
    Number(data.longitude) || 0
  );
  delete data.latitude;
  delete data.longitude;

  if (firebase.auth().currentUser) {
    data.owner_id = firebase.auth().currentUser.uid;
  }
  data.updated = firebase.firestore.FieldValue.serverTimestamp();
  data.moderated = null;

  let fieldsToSave = [
    "moderated",
    "updated",
    "location",
    "owner_id",
    "pieces",
    "categories",
    "missions"
  ];

  return firestore.collection("photos").add(_.pick(data, fieldsToSave));
}

/**
 *
 * @param id
 * @param base64 image in base64 format
 * @returns {firebase.storage.UploadTask}
 */
function savePhoto(id, base64) {
  const originalJpgRef = storageRef
    .child("photos")
    .child(id)
    .child("original.jpg");
  return originalJpgRef.putString(base64, "base64", {
    contentType: "image/jpeg"
  });
}

async function getUser(id): Promise<Partial<User> | undefined> {
  const fbUser = await firestore.collection("users").doc(id).get();
  return fbUser.exists ? (fbUser.data() as Partial<User>) : undefined;
}

async function getFeedbackByID(id: string): Promise<Feedback | null> {
  const fbFeedback = await firestore.collection("feedbacks").doc(id).get();
  return fbFeedback.exists ? { id, ...fbFeedback.data() } : null;
}

async function getPhotoByID(id: string): Promise<Feature | undefined> {
  const fbPhoto = await firestore.collection("photos").doc(id).get();
  const photo = extractPhoto(fbPhoto.data(), fbPhoto.id);
  if (fbPhoto.exists) {
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [photo.location.longitude, photo.location.latitude]
      },
      properties: photo
    };
  }
  return undefined;
}

/**
 *
 * @param howMany
 * @param photos object to keep up to date
 * @returns {() => void}
 */
function photosToModerateRT(
  howMany: number,
  updatePhotoToModerate: (photo: Photo) => void,
  removePhotoToModerate: (photo: Photo) => void
) {
  return firestore
    .collection("photos")
    .where("moderated", "==", null)
    .orderBy("updated", "desc")
    .limit(howMany)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const photo = extractPhoto(change.doc.data(), change.doc.id);
        if (change.type === "added" || change.type === "modified") {
          updatePhotoToModerate(photo);
        } else if (change.type === "removed") {
          removePhotoToModerate(photo);
        } else {
          console.error(`the photo ${photo.id} as type ${change.type}`);
        }
      });
    });
}

async function writeModeration(
  photoId: string,
  userId: string,
  published: boolean
) {
  console.log(`Approving photo ${photoId}`);

  const photoDocRef = firestore.collection("photos").doc(photoId);
  const photoDocData = await photoDocRef.get();

  console.log(photoDocData.data() as Photo);

  await updateMissionOnPhotoModerated(photoDocData.data() as Photo, published);

  return photoDocRef.update({
    moderated: firebase.firestore.FieldValue.serverTimestamp(),
    published: published,
    moderator_id: userId
  });
}

async function disconnect() {
  return firebaseApp.delete();
}

function onConnectionStateChanged(fn: (online: boolean) => void) {
  const conRef = firebase.database().ref(".info/connected");

  function connectedCallBack(snapshot) {
    fn(Boolean(snapshot.val()));
  }

  conRef.on("value", connectedCallBack);

  return () => conRef.off("value", connectedCallBack);
}

async function writeFeedback(data) {
  if (firebase.auth().currentUser) {
    data.owner_id = firebase.auth().currentUser.uid;
  }
  data.updated = firebase.firestore.FieldValue.serverTimestamp();
  if (data.latitude && data.longitude) {
    data.location = new firebase.firestore.GeoPoint(
      Number(data.latitude) || 0,
      Number(data.longitude) || 0
    );
  }

  delete data.latitude;
  delete data.longitude;

  return await firestore.collection("feedbacks").add(data);
}

async function toggleUnreadFeedback(id, resolved, userId) {
  return await firestore.collection("feedbacks").doc(id).update({
    resolved: !resolved,
    customerSupport_id: userId,
    updated: firebase.firestore.FieldValue.serverTimestamp()
  });
}

export default {
  onConnectionStateChanged,
  ownPhotosRT,
  fetchStats,
  fetchFeedbacks,
  fetchPhotos,
  getUser,
  getFeedbackByID,
  getPhotoByID,
  savePhoto,
  saveMetadata,
  photosToModerateRT,
  disconnect,
  writeFeedback,
  writeModeration,
  toggleUnreadFeedback,
  configObserver,
  getBarcodeInfo
};
