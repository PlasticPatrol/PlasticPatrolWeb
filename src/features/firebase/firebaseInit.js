// see https://firebase.google.com/docs/web/setup
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";
import "firebase/firestore";
import "firebase/performance";
// import 'firebase/messaging';
import "firebase/functions";
import "firebase/storage";
import "firebase/analytics";
import "firebase/remote-config";

import config from "./config";

// Initialize Firebase
const firebaseApp = !firebase.apps.length
  ? firebase.initializeApp(config)
  : firebase.app();

const firestore = firebase.firestore();

// remote config: https://firebase.google.com/docs/remote-config/get-started?platform=web
const remoteConfig = firebase.remoteConfig();
// remoteConfig.settings.minimumFetchIntervalMillis = 3600000;
remoteConfig.defaultConfig = {
  enable_missions: false
};

// need to refetch for next time.
remoteConfig
  .fetchAndActivate()
  .then(() => {
    console.log("CAPTURED");
  })
  .catch((err) => {
    console.log("ERROR");
  });

// measuring web performance. See https://firebase.google.com/docs/perf-mon/get-started-web
firebase.performance();
// const perf = firebase.performance(); //don't use the reference yet
// TODO: to measure input delay: https://github.com/GoogleChromeLabs/first-input-delay

function isInIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

// iFrames may break things for security policies. We found it happens at least in safari.
// more info in https://firebase.google.com/docs/firestore/manage-data/enable-offline
if (!isInIframe()) {
  firestore.enablePersistence().catch(function (err) {
    if (err.code === "failed-precondition") {
      console.error(
        "Multiple tabs open, persistence can only be enabled in one tab at a a time."
      );
    } else if (err.code === "unimplemented") {
      console.error(
        "The current browser does not support all of the features required to enable persistence  ..."
      );
    } else {
      console.error("Error firestore.enablePersistence(); didn't work");
    }
  });
} else {
  console.log("Cannot enable persistence inside an iframe");
}

export { firebaseApp, remoteConfig };
