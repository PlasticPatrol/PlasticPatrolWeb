import * as functions from "firebase-functions";

import admin from "firebase-admin";

import { firestore } from "../firestore";
import { ChallengeFromServer, ConfigurableChallengeData } from "./models";

type ChallengeToPersist = Omit<ChallengeFromServer, "id">;

export default functions.https.onCall(
  async (
    restOfChallenge: ConfigurableChallengeData,
    callableContext
  ): Promise<ChallengeFromServer> => {
    const ownerUserId = callableContext.auth?.uid;
    if (!ownerUserId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "User must be authenticated"
      );
    }

    const challengeToPersist: ChallengeToPersist = {
      ...restOfChallenge,
      ownerUserId,
      totalPieces: 0,
      totalUserPieces: [{ uid: ownerUserId, pieces: 0 }],
      pendingUsers: []
    };

    const { id, ...rest } = await firestore
      .collection("challenges")
      .add(challengeToPersist);

    // NOTE: this doesn't work - not all users have a record in Firebase, need to check why we have Gravatar
    // firestore
    //   .collection("users")
    //   .doc(ownerUserId)
    //   .update({
    //     challengeIds: admin.firestore.FieldValue.arrayUnion(id)
    //   });

    return { id, ...challengeToPersist };
  }
);
