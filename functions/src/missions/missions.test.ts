import { assert, expect } from "chai";
import * as admin from "firebase-admin";

// firebase automatically picks up on these environment variables:
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

admin.initializeApp({
  projectId: "test-project-id",
  credential: admin.credential.applicationDefault()
});

import * as myFunctions from "./index";
import getMissionIfExists from "./utils/getMissionIfExists";

export const testEnv = require("firebase-functions-test")();

async function getUserMissions(userId: string): Promise<string[]> {
  // we have no 'getUserIfExists' utility or AFAICT a model for the user
  // in our collection, so just do a one off for testing
  const snapshot = await admin
    .firestore()
    .collection("users")
    .doc(userId)
    .get();

  const { exists } = snapshot;
  if (!exists) {
    // if the user doesn't exist, they definitely don't have any missions
    return [];
  }

  const { missionIds } = snapshot.data() as { missionIds: [string] };
  return missionIds;
}

const endTime = new Date().getUTCMinutes() + 10; // some time in the future

describe("Unit tests", () => {
  after(() => {
    testEnv.cleanup();
  });

  describe("public missions", () => {
    it("create + join", async () => {
      const user = await admin.auth().createUser({});
      const userToJoin = await admin.auth().createUser({});

      // have the user create a mission
      const { id: missionId } = await testEnv.wrap(myFunctions.create)(
        {
          isPrivate: false,
          endTime
        },
        {
          auth: {
            uid: user.uid
          }
        }
      );

      // make sure that the user's missions include that mission now
      var missions = await getUserMissions(user.uid);
      assert.include(missions, missionId);

      // now have a user join the mission (note that the mission is not private, so user
      // should be able to join right away)
      await testEnv.wrap(myFunctions.join)(
        { missionId },
        { auth: { uid: userToJoin.uid } }
      );

      // check that that user now has this mission in it's mission list
      missions = await getUserMissions(userToJoin.uid);
      assert.include(missions, missionId);

      // the mission is not private, so the user should be added directly to the list of users.
      // so at this point it should contain the user who made the mission as well as the user who has
      // just joined, both initialised to 0
      const { totalUserPieces } = await getMissionIfExists(missionId);
      assert.containsAllKeys(totalUserPieces, [user.uid, userToJoin.uid]);
      assert.equal(totalUserPieces[user.uid].pieces, 0);
      assert.equal(totalUserPieces[userToJoin.uid].pieces, 0);
    });

    it("leave", async () => {
      const user = await admin.auth().createUser({});

      // have the user create a mission
      const { id: missionId } = await testEnv.wrap(myFunctions.create)(
        {
          isPrivate: false,
          endTime
        },
        {
          auth: {
            uid: user.uid
          }
        }
      );

      // just do precondition check (tested above in join) so the later test makes sense
      var missions = await getUserMissions(user.uid);
      assert.include(missions, missionId);

      // now leave the mission
      await testEnv.wrap(myFunctions.leave)(
        { missionId },
        { auth: { uid: user.uid } }
      );

      // the user has left, shouldn't have the mission in its list anymore
      missions = await getUserMissions(user.uid);
      assert.notInclude(missions, missionId);

      // ... and their uid shouldn't be in the totalUserPieces field anymore
      const { totalUserPieces } = await getMissionIfExists(missionId);
      assert.doesNotHaveAnyKeys(totalUserPieces, [user.uid]);
    });

    it("does not hide potentially sensitive data if you're not in the mission", async () => {
      const creator = await admin.auth().createUser({});
      const nonMember = await admin.auth().createUser({});

      // have the user create a mission
      const { id: missionId } = await testEnv.wrap(myFunctions.create)(
        {
          isPrivate: false,
          endTime
        },
        {
          auth: {
            uid: creator.uid
          }
        }
      );

      const missionToNonMember = await testEnv.wrap(myFunctions.fetch)(
        { missionId },
        { auth: { uid: nonMember.uid } }
      );
      assert.containsAllKeys(missionToNonMember, ["totalUserPieces"]);

      const missionToMember = await testEnv.wrap(myFunctions.fetch)(
        { missionId },
        { auth: { uid: nonMember.uid } }
      );
      assert.containsAllKeys(missionToMember, ["totalUserPieces"]);
    });
  });

  describe("private missions", () => {
    it("create + join + approve/reject", async () => {
      const creator = await admin.auth().createUser({});
      const userToApprove = await admin.auth().createUser({});
      const userToReject = await admin.auth().createUser({});

      // have the user create a mission
      const { id: missionId } = await testEnv.wrap(myFunctions.create)(
        {
          isPrivate: true,
          endTime
        },
        {
          auth: {
            uid: creator.uid
          }
        }
      );

      // now have both users join the mission, they should be added to pending users list
      await testEnv.wrap(myFunctions.join)(
        { missionId },
        { auth: { uid: userToApprove.uid } }
      );
      await testEnv.wrap(myFunctions.join)(
        { missionId },
        { auth: { uid: userToReject.uid } }
      );

      const { pendingUsers } = await getMissionIfExists(missionId);
      expect(pendingUsers.map(({ uid }) => uid)).to.eql([
        userToApprove.uid,
        userToReject.uid
      ]);

      await testEnv.wrap(myFunctions.approveNewMember)(
        { missionId, userId: userToApprove.uid },
        { auth: { uid: creator.uid } }
      );
      await testEnv.wrap(myFunctions.rejectNewMember)(
        { missionId, userId: userToReject.uid },
        { auth: { uid: creator.uid } }
      );

      // should have no more pending users
      const {
        pendingUsers: nowPendingUsers,
        totalUserPieces
      } = await getMissionIfExists(missionId);
      assert.isEmpty(nowPendingUsers);

      // the one that got approved should have the mission in their mission list and be in total pieces
      var missions = await getUserMissions(userToApprove.uid);
      assert.include(missions, missionId);
      assert.containsAllKeys(totalUserPieces, [userToApprove.uid]);

      // the one that got rejected should not
      var missions = await getUserMissions(userToReject.uid);
      assert.notInclude(missions, missionId);
      assert.doesNotHaveAnyKeys(totalUserPieces, [userToReject.uid]);
    });

    it("hides potentially sensitive data if you're not in the mission", async () => {
      const creator = await admin.auth().createUser({});
      const nonMember = await admin.auth().createUser({});

      // have the user create a mission
      const { id: missionId } = await testEnv.wrap(myFunctions.create)(
        {
          isPrivate: true,
          endTime
        },
        {
          auth: {
            uid: creator.uid
          }
        }
      );

      const missionToNonMember = await testEnv.wrap(myFunctions.fetch)(
        { missionId },
        { auth: { uid: nonMember.uid } }
      );
      assert.doesNotHaveAnyKeys(missionToNonMember, ["totalUserPieces"]);

      const missionToMember = await testEnv.wrap(myFunctions.fetch)(
        { missionId },
        { auth: { uid: creator.uid } }
      );
      assert.containsAllKeys(missionToMember, ["totalUserPieces"]);
    });
  });

  // TODO test updateMissionOnPhotoEdit + updateMissionOnPhotoUpload
});
