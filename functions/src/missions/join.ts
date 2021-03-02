import * as functions from "firebase-functions";

import { auth, firestore } from "firebase-admin";

import { getDisplayName } from "../stats";

import getMissionIfExists from "./utils/getMissionIfExists";
import verifyMissionIsOngoing from "./utils/verifyMissionIsOngoing";
import addMissionToUser from "./utils/addMissionToUser";

type RequestData = { missionId: string };

export default functions.https.onCall(
  async ({ missionId }: RequestData, callableContext) => {
    if (!missionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing missionId"
      );
    }
    const currentUserId = callableContext.auth?.uid;
    if (!currentUserId) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const mission = await getMissionIfExists(missionId);

    const missionIsOngoing = verifyMissionIsOngoing(mission);
    if (!missionIsOngoing) {
      throw new functions.https.HttpsError(
        "unavailable",
        "Mission has already ended"
      );
    }

    const { isPrivate } = mission;
    const user = await auth().getUser(currentUserId);
    const displayName = getDisplayName(user);

    const missionRef = firestore().collection("missions").doc(missionId);
    if (isPrivate) {
      await missionRef.update({
        pendingUsers: firestore.FieldValue.arrayUnion({
          uid: currentUserId,
          displayName
        })
      });
    } else {
      await Promise.all([
        missionRef.set(
          {
            totalUserPieces: {
              [currentUserId]: {
                uid: currentUserId,
                displayName,
                pieces: 0
              }
            }
          },
          { merge: true }
        ),
        addMissionToUser(currentUserId, missionId)
      ]);
    }

    // not sure what to return here
    return;
  }
);
