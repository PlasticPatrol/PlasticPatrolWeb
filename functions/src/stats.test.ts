import { it } from "mocha";
import { strict as assert } from "assert";
import { computeStats, updateStatsWithPieces } from "./stats";
import { QuerySnapshot } from "@google-cloud/firestore";
import { stubInterface } from "ts-sinon";
import { User, Photo, Group, BaseStats } from "./types";
import admin from "firebase-admin";
import _ from "lodash";

function makeQuerySnapshot<T>(id: string, data: T): QuerySnapshot {
  const snapshot = stubInterface<QuerySnapshot>();
  // @ts-ignore
  snapshot.forEach = (f) => [{ id, data: () => data }].forEach(f);
  return snapshot;
}

const empty: BaseStats = {
  uploaded: 0,
  totalUploaded: 0,
  pieces: 0,
  largeCollectionUploads: 0,
  largeCollectionPieces: 0
};

describe("stats", () => {
  it("tracks large uploads correctly", () => {
    const stats = _.clone(empty);
    [2000, 1].forEach((pieces) => updateStatsWithPieces(stats, pieces));

    assert.deepEqual(stats, {
      uploaded: 2,
      totalUploaded: 2,
      pieces: 2001,
      largeCollectionPieces: 2000,
      largeCollectionUploads: 1
    });
  });

  it("computesStats for users without groups", () => {
    const userId = "123";
    const groupId = "456";

    // @ts-ignore
    const rawUser: admin.auth.UserRecord = {
      uid: userId,
      displayName: "Bob"
    };

    const user: User = {};

    const photo: Photo = {
      owner_id: userId,
      moderated: true,
      published: true,
      pieces: 10
    };

    const group: Group = {
      displayName: "My Group"
    };

    const stats = computeStats(
      [rawUser],
      makeQuerySnapshot<Group>(groupId, group),
      makeQuerySnapshot("photoId", photo),
      makeQuerySnapshot(userId, user)
    );
    assert.deepEqual(stats.totalUploaded, 1);
    assert.deepEqual(stats.moderated, 1);
    assert.deepEqual(stats.rejected, 0);
    assert.deepEqual(stats.published, 1);
    assert.deepEqual(stats.pieces, 10);
    assert.deepEqual(stats.users, [
      {
        uid: userId,
        displayName: "Bob",
        pieces: 10,
        uploaded: 1,
        totalUploaded: 1,
        largeCollectionUploads: 0,
        largeCollectionPieces: 0
      }
    ]);
    assert.deepEqual(stats.groups, [
      {
        gid: groupId,
        displayName: "My Group",
        pieces: 0,
        uploaded: 0,
        totalUploaded: 0,
        largeCollectionUploads: 0,
        largeCollectionPieces: 0
      }
    ]);
  });

  it("computesStats with groups", () => {
    const userId = "123";
    const groupId = "456";

    // @ts-ignore
    const rawUser: admin.auth.UserRecord = {
      uid: userId,
      displayName: "Bob"
    };

    const user: User = {
      groups: [groupId]
    };

    const photo: Photo = {
      owner_id: userId,
      moderated: true,
      published: true,
      pieces: 10
    };

    const group: Group = {
      displayName: "My Group"
    };

    const stats = computeStats(
      [rawUser],
      makeQuerySnapshot<Group>(groupId, group),
      makeQuerySnapshot("photoId", photo),
      makeQuerySnapshot(userId, user)
    );

    assert.deepEqual(stats.totalUploaded, 1);
    assert.deepEqual(stats.moderated, 1);
    assert.deepEqual(stats.rejected, 0);
    assert.deepEqual(stats.published, 1);
    assert.deepEqual(stats.pieces, 10);
    assert.deepEqual(stats.users, [
      {
        uid: userId,
        displayName: "Bob",
        pieces: 10,
        uploaded: 1,
        totalUploaded: 1,
        largeCollectionUploads: 0,
        largeCollectionPieces: 0
      }
    ]);
    assert.deepEqual(stats.groups, [
      {
        gid: groupId,
        displayName: "My Group",
        pieces: 10,
        uploaded: 1,
        totalUploaded: 1,
        largeCollectionUploads: 0,
        largeCollectionPieces: 0
      }
    ]);
  });
});
