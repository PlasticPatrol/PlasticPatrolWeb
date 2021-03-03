import * as functions from "firebase-functions";

import { Mission } from "missions/models";
import { firestore } from "firebase-admin";

export default async function getMissionIfExists(
  missionId: string
): Promise<Mission> {
  const snapshot = await firestore()
    .collection("missions")
    .doc(missionId)
    .get();

  if (!snapshot.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "No mission exists for id"
    );
  }

  return snapshot.data() as Mission;
}
