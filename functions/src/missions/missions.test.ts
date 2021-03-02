import * as admin from "firebase-admin";

// firebase automatically picks up on these environment variables:
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

admin.initializeApp({
  projectId: "project-id",
  credential: admin.credential.applicationDefault()
});

import * as myFunctions from "./index";

export const testEnv = require("firebase-functions-test")();

describe("Unit tests", () => {
  after(() => {
    //testEnv.cleanup();
  });

  it("tests create + join + leave flow", async () => {
    const user = await admin.auth().createUser({});
    await testEnv.wrap(myFunctions.create)(
      {},
      {
        auth: {
          uid: user.uid
        }
      }
    );
  });
});
