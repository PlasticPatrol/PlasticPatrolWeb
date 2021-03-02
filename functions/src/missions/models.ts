export type User = { uid: string; pieces: number; displayName: string };

export type PendingUser = { uid: string; displayName: string };

export type TotalUserPieces = { [uid: string]: User };
export type PendingUsers = Array<PendingUser>;
export type MissionFromServer = {
  id: string;
  name: string;
  ownerUserId: string;
  description: string;
  isPrivate: boolean;
  startTime: number;
  endTime: number;
  targetPieces: number;
  totalPieces: number;
  totalUserPieces: TotalUserPieces;
  pendingPieces: number;
  pendingUsers: PendingUsers;
};

export type Mission = Omit<MissionFromServer, "id">;

export type ConfigurableMissionData = {
  name: string;
  description: string;
  isPrivate: boolean;
  startTime: number;
  endTime: number;
  targetPieces: number;
};
