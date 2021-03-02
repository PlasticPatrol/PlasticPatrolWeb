import * as functions from "firebase-functions";

import { firestore } from "firebase-admin";
import addMissionToUser from "./utils/addMissionToUser";
import getMissionIfExists from "./utils/getMissionIfExists";
import verifyMissionIsOngoing from "./utils/verifyMissionIsOngoing";

type RequestData = { missionId: string; userId: string };

export default functions.https.onCall(
  async (
    { missionId, userId: userIdBeingApproved }: RequestData,
    callableContext
  ) => {
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

    const { ownerUserId, pendingUsers } = mission;

    const pendingUser = pendingUsers.find(
      ({ uid }) => uid === userIdBeingApproved
    );

    if (!pendingUser) {
      throw new functions.https.HttpsError(
        "not-found",
        "pending user not found"
      );
    }

    if (ownerUserId !== currentUserId) {
      const userDoc = await firestore()
        .collection("users")
        .doc(currentUserId)
        .get();
      const isModerator = userDoc.data()?.isModerator;

      if (!isModerator) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "permission-denied"
        );
      }
    }

    const missionIsOngoing = verifyMissionIsOngoing(mission);
    if (!missionIsOngoing) {
      throw new functions.https.HttpsError("unavailable", "Mission has ended");
    }

    const updates = {
      totalUserPieces: {
        ...mission.totalUserPieces,
        [userIdBeingApproved]: {
          ...pendingUser,
          pieces: 0
        }
      },
      pendingUsers: pendingUsers.filter(
        ({ uid }) => uid !== userIdBeingApproved
      )
    };

    await Promise.all([
      firestore().collection("missions").doc(missionId).update(updates),
      addMissionToUser(userIdBeingApproved, missionId)
    ]);

    return {};
  }
);
