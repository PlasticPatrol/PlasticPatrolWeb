import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";

import getMissionIfExists from "../utils/getMissionIfExists";
import verifyMissionIsOngoing from "../utils/verifyMissionIsOngoing";

export default functions.firestore
  .document("photos/{photoId}")
  .onCreate(async (snapshot) => {
    const photo = snapshot.data();

    if (!photo) {
      throw new Error("No photo data available from snapshot");
    }

    const { missions, pieces } = photo;

    if (!missions || missions.length === 0 || pieces === 0) {
      return;
    }

    await Promise.all(
      missions.map(async (missionId: string) => {
        try {
          const mission = await getMissionIfExists(missionId);
          if (!verifyMissionIsOngoing(mission)) {
            return;
          }

          await firestore()
            .collection(missions)
            .doc(missionId)
            .update({
              pendingPieces: firestore.FieldValue.increment(pieces)
            });
        } catch (err) {
          console.info("Error updating mission with pieces");
        }
      })
    );
  });
