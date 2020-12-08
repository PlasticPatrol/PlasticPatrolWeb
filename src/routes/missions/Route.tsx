import React from "react";
import {
  MissionPage,
  MissionsHome,
  CreateMission,
  EditMission
} from "pages/missions";
import {
  linkToManagePendingMembers,
  linkToMission,
  linkToMissionsPage,
  linkToCreateMission,
  linkToEditMission
} from "./links";
import { Route, Switch } from "react-router-dom";
import { useHistory } from "react-router";
import ManagePendingMembers from "../../pages/missions/view/ManagePendingMembers";
import User from "../../types/User";

type Props = {};

export default function MissionsRoute({}: Props) {
  const history = useHistory();
  return (
    <Switch>
      <Route exact path={linkToMissionsPage()}>
        <MissionsHome />
      </Route>
      <Route path={linkToCreateMission()}>
        <CreateMission />
      </Route>
      <Route path={linkToManagePendingMembers()}>
        <ManagePendingMembers />
      </Route>
      <Route path={linkToEditMission()}>
        <EditMission />
      </Route>
      <Route path={linkToMission()}>
        <MissionPage />
      </Route>
    </Switch>
  );
}
