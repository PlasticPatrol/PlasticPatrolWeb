// @ts-nocheck
import firebase from "firebase/app";
import md5 from "md5";

import User from "types/User";
import { gtagEvent, gtagSetId } from "gtag.js";

import dbFirebase from "./dbFirebase";

const getProvider = (user) => {
  if (user.providerData.length > 0) {
    return user.providerData[0].providerId;
  }
  return null;
};

type Args = {
  onSignOut: () => void;
  setUser: (user?: User) => void;
};

export const onAuthStateChanged = ({ onSignOut, setUser }: Args) => {
  let userRef;

  const firebaseStatusChange = async (user: firebase.User) => {
    if (!user) {
      // if the user is signed in, then sign out
      if (userRef) {
        userRef = undefined;
        onSignOut();
        setUser(undefined);
      }
      return;
    }

    gtagSetId(user?.uid);
    gtagEvent("Logged in", "User", user?.uid);

    const gravatarURL =
      "https://www.gravatar.com/" + md5(user?.email) + ".json";
    const photoURL =
      user.photoURL || "https://www.gravatar.com/avatar/" + md5(user?.email);
    let currentUser = new User(
      user.uid,
      user.displayName || "",
      false,
      user.email || "",
      user.isAnonymous,
      user.phoneNumber || "",
      photoURL,
      "",
      null,
      "",
      getProvider(user)
    );

    // this has to be global to be found by the jsonp
    window.userFromGravatar = (profile) => {
      const info = profile.entry[0];
      currentUser.description = info.aboutMe;
      currentUser.location = info.currentLocation;
      currentUser.profileURL = info.profileUrl;
      currentUser.displayName = info.name
        ? info.name.formatted
        : currentUser.displayName;
    };

    // add a script node to the dom. The browser will run it but we don't know when.
    const script = document.createElement("script");
    script.src = `${gravatarURL}?callback=userFromGravatar`;
    document.head.append(script);

    setUser(currentUser);
    userRef = currentUser;

    try {
      const userFirebaseData = await dbFirebase.getUser(user.uid);
      currentUser = {
        ...currentUser,
        ...userFirebaseData
      };
    } catch {}

    // creates a new object ref so react updates
    console.log(
      `calling setUser inside firebase status change for ${user.uid}`
    );
    setUser({ ...currentUser });
  };
  return firebase.auth().onAuthStateChanged(firebaseStatusChange);
};

export const signOut = async () => {
  await firebase.auth().signOut();
};

export const sendEmailVerification = () => {
  return firebase
    .auth()
    .currentUser?.sendEmailVerification()
    .then(() => {
      const message = {
        title: "Notification",
        body:
          "A verification link has been sent to email account: " +
          firebase.auth().currentUser?.email
      };
      return message;
    })
    .catch((error) => {
      return {
        title: "Warning",
        body: error.message
      };
    });
};
