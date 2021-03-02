import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";

import getMissionIfExists from "../utils/getMissionIfExists";

async function decrementPendingPieces(
  missionId: string,
  numberToDecrement: number
) {
  return await firestore()
    .collection("missions")
    .doc(missionId)
    .update({
      pendingPieces: firestore.FieldValue.increment(-numberToDecrement)
    });
}

export default functions.firestore
  .document("photos/{photoId}")
  .onUpdate(async (change) => {
    const newValue = change.after.data();

    const previousValue = change.before.data();

    if (!newValue || !previousValue) {
      return;
    }

    const {
      missions,
      pieces,
      moderated: newModerated,
      owner_id: photoUploaderId,
      published
    } = newValue;
    const { moderated: prevModerated } = previousValue;

    const hasJustBeenModerated = newModerated && !prevModerated;

    if (
      !missions ||
      missions.length === 0 ||
      Number(pieces) === 0 ||
      !hasJustBeenModerated
    ) {
      return;
    }

    await Promise.all(
      missions.map(async (missionId: string) => {
        try {
          const mission = await getMissionIfExists(missionId);

          if (published) {
            //check user is still part of mission, if they aren't we won't add to the mission total
            //but still need to decrement the pending pieces as we will have incremented it in `onPhotoUpload`
            if (!mission.totalUserPieces[photoUploaderId]) {
              await decrementPendingPieces(missionId, pieces);
              return;
            }

            await firestore()
              .collection("missions")
              .doc(missionId)
              .update({
                totalPieces: firestore.FieldValue.increment(pieces),
                pendingPieces: firestore.FieldValue.increment(-pieces),
                [`totalUserPieces.${photoUploaderId}.pieces`]: firestore.FieldValue.increment(
                  pieces
                )
              });
          } else {
            await decrementPendingPieces(missionId, pieces);
          }
        } catch (err) {
          console.error(err);
        }
      })
    );
  });
