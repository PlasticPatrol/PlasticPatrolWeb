import _ from "lodash";
import { firestore, auth } from "firebase-admin";
import { QuerySnapshot, QueryDocumentSnapshot } from "@google-cloud/firestore";
import { Stats, UserStats, GroupStats, notEmpty, BaseStats } from "./types";

const LARGE_COLLECTION_THRESHOLD = 1000;

export const updateStatsWithPieces = (
  stats: BaseStats,
  pieces: number
): void => {
  stats.uploaded++;
  stats.totalUploaded++;
  if (pieces > 0) {
    stats.pieces += pieces;
  }
  if (pieces > LARGE_COLLECTION_THRESHOLD) {
    stats.largeCollectionUploads++;
    stats.largeCollectionPieces += pieces;
  }
};

/*
 * Use the display name on the user record itself if present,
 * otherwise just use the UID
 */
export const getDisplayName = (user: auth.UserRecord): string => {
  if (user.displayName) {
    return user.displayName;
  } else {
    return user.uid;
  }
};

/**
 * compute the stats from the given data about users, groups and photos
 */
export const computeStats = (
  rawUsers: auth.UserRecord[],
  groupsSnapshot: QuerySnapshot,
  photosSnapshot: QuerySnapshot,
  usersSnapshot: QuerySnapshot
): Stats => {
  const users: UserStats[] = rawUsers.map((user) => {
    const userShort = {
      uid: user.uid,
      displayName: getDisplayName(user),
      pieces: 0,
      totalUploaded: 0,
      uploaded: 0,
      largeCollectionUploads: 0,
      largeCollectionPieces: 0
    };
    return userShort;
  });

  const groups: GroupStats[] = [];
  groupsSnapshot.forEach((doc: QueryDocumentSnapshot) => {
    const { displayName } = doc.data();
    groups.push({
      gid: doc.id,
      displayName: displayName || "",
      pieces: 0,
      uploaded: 0,
      totalUploaded: 0,
      largeCollectionUploads: 0,
      largeCollectionPieces: 0
    });
  });

  const stats: Stats = {
    moderated: 0,
    published: 0,
    rejected: 0,
    pieces: 0,
    totalUploaded: 0,
    uploaded: 0,
    largeCollectionUploads: 0,
    largeCollectionPieces: 0,
    users,
    groups
  };

  // map from user -> the list of groups they are in
  const userToGroups: { [key: string]: GroupStats[] } = {};
  usersSnapshot.forEach((doc: QueryDocumentSnapshot) => {
    // users can have a "groups" field with a list of group IDs.
    const userGroups = doc.data().groups;
    if (userGroups !== undefined) {
      // if the user has "groups", then find the group stats object corresponding
      // to that group and set the resulting list in userToGroups
      userToGroups[doc.id] = userGroups
        .map((groupId: string) => groups.find((group) => group.gid === groupId))
        .filter(notEmpty);
    }
  });

  photosSnapshot.forEach((doc) => {
    const data = doc.data();

    // has the upload been reviewed by a moderator ?
    if (data.moderated) {
      stats.moderated++;

      // has it been approved ?
      if (data.published) {
        stats.published++;

        const pieces = Number(data.pieces);
        updateStatsWithPieces(stats, pieces);

        const owner = users.find((user) => user.uid === data.owner_id);

        // for each group that the owner is a member of, add the
        // # of pieces to that group's total count
        if (owner && owner.uid in userToGroups) {
          userToGroups[owner.uid].forEach((group) => {
            updateStatsWithPieces(group, pieces);
          });
        }

        if (owner) {
          updateStatsWithPieces(owner, pieces);
        }
      } else {
        stats.rejected++;
      }
    }
  });
  return stats;
};

/**
 * fetch all the users from the authentication database (not from our "users" collection")
 */
async function fetchUsers(): Promise<auth.UserRecord[]> {
  // get all the users
  let users: auth.UserRecord[] = [];
  let pageToken = undefined;
  do {
    /* eslint-disable no-await-in-loop */
    const listUsersResult: auth.ListUsersResult = await auth().listUsers(
      1000,
      pageToken
    );
    pageToken = listUsersResult.pageToken;
    if (listUsersResult.users) {
      users = users.concat(listUsersResult.users);
    }
  } while (pageToken);
  return users;
}

/**
 * computes and returns the current stats but doesn't save them to the DB
 */
export const computeStatsAdHoc = async () => {
  const [rawUsers, groupDocuments, photos, users] = await Promise.all([
    fetchUsers(),
    firestore().collection("groups").get(),
    firestore().collection("photos").get(),
    firestore().collection("users").get()
  ]);
  return computeStats(rawUsers, groupDocuments, photos, users);
};

/**
 * recalculate the stats and save them in the DB
 *
 * @type {CloudFunction<Message>}
 */
export const updateStats = async () => {
  const stats = await computeStatsAdHoc();
  const statsWithTimestamp = {
    updated: firestore.FieldValue.serverTimestamp(),
    ...stats
  };
  return await firestore()
    .collection("sys")
    .doc("stats")
    .set(statsWithTimestamp);
};
