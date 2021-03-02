import * as functions from "firebase-functions";

import { auth, firestore } from "firebase-admin";

import { getDisplayName } from "../stats";
import { MissionFromServer, ConfigurableMissionData } from "./models";
import addMissionToUser from "./utils/addMissionToUser";

type MissionToPersist = Omit<MissionFromServer, "id">;

export default functions.https.onCall(
  async (
    restOfMission: ConfigurableMissionData,
    callableContext
  ): Promise<MissionFromServer> => {
    const ownerUserId = callableContext.auth?.uid;
    if (!ownerUserId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "User must be authenticated"
      );
    }
    const user = await auth().getUser(ownerUserId);
    const displayName = getDisplayName(user);

    const missionToPersist: MissionToPersist = {
      ...restOfMission,
      ownerUserId,
      totalPieces: 0,
      totalUserPieces: {
        [ownerUserId]: { uid: ownerUserId, pieces: 0, displayName }
      },
      pendingPieces: 0,
      pendingUsers: []
    };

    const { id } = await firestore()
      .collection("missions")
      .add(missionToPersist);

    await addMissionToUser(ownerUserId, id);

    return { id, ...missionToPersist };
  }
);
