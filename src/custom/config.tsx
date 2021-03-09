import React from "react";

import AccountCircleIcon from "@material-ui/icons/AccountCircle";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import GroupIcon from "@material-ui/icons/Group";
import SchoolIcon from "@material-ui/icons/School";
import DashboardIcon from "@material-ui/icons/Dashboard";
import HelpIcon from "@material-ui/icons/Help";
import EventIcon from "@material-ui/icons/Event";
import FeedbackIcon from "@material-ui/icons/Feedback";
import LibraryBooksIcon from "@material-ui/icons/LibraryBooks";
import MissionIconImage from "assets/images/mission.png";

import styles from "standard.scss";

import User from "types/User";
import Page from "types/Page";

import { linkToFeedbackReports } from "routes/feedback-reports/links";
import { linkToTutorialPage } from "routes/tutorial/links";
import { linkToAboutPage } from "routes/about/links";

import { remoteConfig } from "../features/firebase/firebaseInit";

const primaryMain = styles.primaryMain;
const primaryContrastText = styles.primaryContrastText;
const secondaryMain = styles.secondaryMain;
const secondaryContrastText = styles.primaryContrastText;

export const linkToMap = () => "/";

const PAGES: { [pageName: string]: Page } = {
  map: {
    path: linkToMap(),
    label: "Map"
  },
  embeddable: {
    path: "/embeddable",
    label: "Map"
  },
  photos: {
    path: "/photo",
    label: "Photo"
  },
  moderator: {
    path: "/moderator",
    label: "Photo Approval",
    icon: <CheckCircleIcon />,
    visible: (user: User | undefined, online: boolean) =>
      !!(user && user.isModerator)
  },
  account: {
    path: "/account",
    label: "Account",
    icon: <AccountCircleIcon />,
    visible: (user: User | undefined, online: boolean) => !!user
  },
  about: {
    path: linkToAboutPage(),
    label: "About",
    visible: (user: User | undefined, online: boolean) => true,
    icon: <HelpIcon />
  },
  tutorial: {
    path: linkToTutorialPage(),
    label: "Tutorial",
    visible: (user: User | undefined, online: boolean) => true,
    icon: <SchoolIcon />
  },
  writeFeedback: {
    path: "/write-feedback",
    label: "Feedback",
    visible: (user: User | undefined, online: boolean) => true,
    icon: <FeedbackIcon />
  },
  events: {
    path: "/events",
    label: "Clean-ups"
  },
  partners: {
    path: "/partners",
    label: "Partners"
  },
  leaderboard: {
    path: "/leaderboard",
    label: "Leaderboard",
    visible: (user: User | undefined, online: boolean) => true,
    icon: <DashboardIcon />
  },
  feedbackReports: {
    path: linkToFeedbackReports(),
    label: "Feedback Reports",
    icon: <LibraryBooksIcon />,
    visible: (user: User | undefined, online: boolean) =>
      !!(user && user.isModerator)
  },
  displayPhoto: {
    path: "/photos",
    label: "photos"
  },
  cleanUps: {
    path: "https://planetpatrol.co/clean-ups/",
    visible: (user: User | undefined, online: boolean) => true,
    icon: <EventIcon />,
    label: "Clean-ups"
  },
  groups: {
    path: "/groups",
    label: "Groups",
    visible: (user, online) => true,
    icon: <GroupIcon />
  },
  grouplist: {
    path: "/grouplist",
    label: "List Groups",
    visible: (user, online) => true
  },
  groupadd: {
    path: "/groupadd",
    label: "Create a Group",
    visible: (user, online) => true
  },
  missions: {
    path: "/missions",
    label: "Missions",
    visible: (user, online) =>
      !!(
        remoteConfig.getBoolean("enable_missions") ||
        user?.email.endsWith("@geovation.uk") ||
        user?.email.endsWith("@plasticpatrol.co.uk") ||
        user?.email.endsWith("sebastian.ovide@gmail.com") ||
        user?.email.endsWith("munfro@gmail.com") ||
        localStorage.getItem("enable_missions")
      ),
    icon: (
      <img
        src={MissionIconImage}
        alt="Missions icon"
        style={{ width: 20, height: 20, paddingLeft: 2 }}
      />
    )
  }
};

export interface Metadata {
  metadataServerUrl: string;
  serverUrl: string;
  twSite: string;
  twCreator: string;
  twDomain: string;
  _twDescriptionField: string;
  twDescription: string;
  twTitle: string;
}

export interface Config {
  PAGES: { [pageName: string]: Page };
  ENABLE_GROUPS: boolean;
  ENABLE_MISSIONS: boolean;
  metadata: Metadata;
  MAX_IMAGE_SIZE: number;
  THEME: any;
  MAP_SOURCE: string;
  MAPBOX_TOKEN: string;
  GA_TRACKING_ID: string;
  GA_PROPERTY_ID: string;
  PHOTO_ZOOMED_FIELDS: any;
  ZOOM: number;
  ZOOM_FLYTO: number;
  CENTER: [number, number];
  ENABLE_GRAVATAR_PROFILES: boolean;
  SECURITY: {
    UPLOAD_REQUIRES_LOGIN: boolean;
  };
  MODERATING_PHOTOS: number;
  LEADERBOARD_FIELD: any;
}

const config: Config = {
  metadata: {
    metadataServerUrl: "https://md.plasticpatrol.co.uk",
    serverUrl: "https://app.plasticpatrol.co.uk",
    twSite: "@Plastic_Patrol",
    twCreator: "@LizzieOutside",
    twDomain: "www.plasticpatrol.co.uk",
    _twDescriptionField: "pieces",
    twDescription:
      "The global movement that is crowdsource cleaning the planet. Download the Planet Patrol app to join the movement!",
    twTitle: "Plastic Patrol"
  },
  MAX_IMAGE_SIZE: 2048,
  THEME: {
    palette: {
      primary: { main: primaryMain, contrastText: primaryContrastText },
      secondary: { main: secondaryMain, contrastText: secondaryContrastText }
    },
    typography: {
      fontFamily: ["BrownSTD"]
    },
    spacing: 10
  },
  MAP_SOURCE: "mapbox://styles/mapbox/streets-v10",
  // MAP_SOURCE: "https://s3-eu-west-1.amazonaws.com/tiles.os.uk/styles/open-zoomstack-outdoor/style.json",
  // MAP_ATTRIBUTION: "Contains OS data &copy; Crown copyright and database rights 2018",
  MAPBOX_TOKEN:
    "pk.eyJ1IjoibmVpbGZ1bHdpbGVyIiwiYSI6ImNrOGN1dWV2bzBxaHIzZnRxaDhtOWJ0ODYifQ.D56TN1nXxU0vGfmYb21T2w",
  GA_TRACKING_ID: "UA-126516084-1",
  GA_PROPERTY_ID: "189010506",
  PHOTO_ZOOMED_FIELDS: {
    updated: (s: string) => new Date(s).toDateString(),
    pieces: (s: string) => s
  },
  ZOOM: 5,
  ZOOM_FLYTO: 15,
  CENTER: [-2, 55],
  PAGES,
  ENABLE_GRAVATAR_PROFILES: true, //To update user-profile from Gravatar, value: true or false.
  ENABLE_GROUPS: false,
  ENABLE_MISSIONS: true,
  SECURITY: {
    UPLOAD_REQUIRES_LOGIN: true
  },
  MODERATING_PHOTOS: 15,
  LEADERBOARD_FIELD: {
    label: "Pieces",
    field: "pieces"
  }
};

export default config;
