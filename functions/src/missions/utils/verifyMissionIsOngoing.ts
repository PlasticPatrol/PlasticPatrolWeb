import { Mission } from "missions/models";

export default function verifyMissionIsOngoing(mission: Mission) {
  const { endTime } = mission;
  const currentTime = new Date().getUTCMinutes();

  return endTime < currentTime;
}
