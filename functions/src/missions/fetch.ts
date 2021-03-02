import * as functions from "firebase-functions";

import getMissionIfExists from "./utils/getMissionIfExists";

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

    const { isPrivate, totalUserPieces } = mission;

    const isInMission = !!Boolean(totalUserPieces[currentUserId]);

    if (isPrivate && !isInMission) {
      const { totalUserPieces, ...safeMission } = mission;
      return safeMission;
    }

    return mission;
  }
);
