import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { HashRouter as Router } from "react-router-dom";
import * as firebaseui from "firebaseui";
import firebase from "firebase/app";

import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";

import "./index.scss";
import App from "./App";

import { firebaseApp } from "features/firebase/firebaseInit";

import LoginFirebase from "./components/LoginFirebase";
import * as serviceWorker from "./serviceWorker";
import config from "./custom/config";
import { isIphoneAndCordova } from "./utils";
import { gtagInit } from "./gtag.js";
import LocationProvider, { useGPSLocation } from "./providers/LocationProvider";
import { usePhotos } from "./providers/PhotosProvider";
import SelectedFeatureProvider, {
  useSelectedFeature
} from "./providers/SelectedFeatureProvider";
import { useConfig } from "./providers/ConfigProvider";
import { useOnline } from "./providers/OnlineProvider";
import UserProvider, { useUser } from "./providers/UserProvider";
import StatsProvider from "./providers/StatsProvider";
import { dbFirebase } from "features/firebase";
import { MissionsProvider, useChallenges } from "./providers/MissionsProvider";

serviceWorker.register();

function initialiseCypressVars() {
  if (window.Cypress) {
    window.__firebase__ = firebaseApp;
  }
}

initialiseCypressVars();

if (isIphoneAndCordova) {
  window.StatusBar.styleDefault();
}

if (
  process.env.NODE_ENV !== "development" &&
  localStorage.getItem("debug") !== "true"
) {
  console.log = console.info = console.trace = console.warn = console.error = console.debug = (
    _
  ) => {};
}
// it must set to fals (not enough to be absent)
const devDissableDebugLog = localStorage.getItem("debug") === "false";
if (devDissableDebugLog) {
  console.debug = (_) => {};
}

const theme = createMuiTheme(config.THEME);

const Wrapper = () => {
  const gpsLocation = useGPSLocation();
  const [{ geojson }, reloadPhotos] = usePhotos();
  const online = useOnline();
  const selectedFeature = useSelectedFeature();
  const { sponsorImage } = useConfig();
  const user = useUser();

  useEffect(() => {
    return () => dbFirebase.disconnect();
  }, []);

  return (
    <App
      config={config}
      gpsLocation={gpsLocation}
      geojson={geojson}
      reloadPhotos={reloadPhotos}
      online={online}
      sponsorImage={sponsorImage}
      selectedFeature={selectedFeature}
      user={user}
    />
  );
};

const startApp = () => {
  gtagInit();

  ReactDOM.render(
    <Router>
      <MuiThemeProvider theme={theme}>
        <LocationProvider>
          <SelectedFeatureProvider>
            <StatsProvider>
              <MissionsProvider>
                <UserProvider>
                  <Wrapper />
                </UserProvider>
              </MissionsProvider>
            </StatsProvider>
          </SelectedFeatureProvider>
        </LocationProvider>
      </MuiThemeProvider>
    </Router>,
    document.getElementById("root")
  );
};

if (!window.cordova) {
  startApp();
} else {
  document.addEventListener("deviceready", startApp, false);
}
