import Geojson from "types/Geojson";
import * as localforage from "localforage";
import * as Rx from "rxjs";
import { bufferTime } from "rxjs/operators";
import { Map } from "immutable";
import { useEffect, useState, useCallback } from "react";
import { dbFirebase } from "features/firebase";
import Photo, { PhotosContainer } from "types/Photo";
import Feature from "types/Feature";
import MapLocation from "types/MapLocation";
import config from "custom/config";
import { useLocation } from "react-router-dom";
import { Location, History } from "history";
import { RealtimeUpdate } from "features/firebase/dbFirebase";
import _ from "lodash";
import { useAsyncEffect } from "utils";
import { useUser } from "UserProvider";

const photoToFeature = (photo: Photo): Feature => ({
  feature: "Feature",
  geometry: {
    type: "Point",
    coordinates: [photo.location.longitude, photo.location.latitude]
  },
  properties: photo
});

const toFeaturesDict = (photos: Photo[]): Map<string, Feature> => {
  return Map(photos.map((photo) => [photo.id, photoToFeature(photo)]));
};

const geojsonToPhotosContainer = (geojson: Geojson): PhotosContainer => {
  return {
    featuresDict: toFeaturesDict(geojson.features.map((f) => f.properties)),
    geojson
  };
};

const photosToPhotosContainer = (photos: Photo[]): PhotosContainer => {
  const features = photos.map((photo) => photoToFeature(photo));
  return {
    featuresDict: Map(
      features.map((feature) => [feature.properties.id, feature])
    ),
    geojson: {
      type: "FeatureCollection",
      features
    }
  };
};

const merge = (
  left: PhotosContainer,
  right: PhotosContainer
): PhotosContainer => {
  const featuresDict = left.featuresDict.merge(right.featuresDict);
  return {
    featuresDict,
    geojson: {
      type: "FeatureCollection",
      features: Array.from(featuresDict.values())
    }
  };
};

export const extractPathnameParams = (
  location: Location<History.PoorMansUnknown>
): { photoId?: string; mapLocation: MapLocation } => {
  // extracts photoID
  const regexPhotoIDMatch = location.pathname.match(
    new RegExp(`${config.PAGES.displayPhoto.path}\\/(\\w+)`)
  );

  const photoId = regexPhotoIDMatch && regexPhotoIDMatch[1];

  // extracts mapLocation
  const regexMapLocationMatch = location.pathname.match(
    new RegExp("@(-?\\d*\\.?\\d*),(-?\\d*\\.?\\d*),(\\d*\\.?\\d*)z")
  );

  const mapLocation =
    (regexMapLocationMatch &&
      new MapLocation(
        regexMapLocationMatch[1],
        regexMapLocationMatch[2],
        regexMapLocationMatch[3]
      )) ||
    new MapLocation();
  if (!regexMapLocationMatch) {
    mapLocation.zoom = config.ZOOM;
  }

  return { photoId: photoId || undefined, mapLocation };
};

const EMPTY: PhotosContainer = {
  featuresDict: Map<string, Feature>(),
  geojson: {
    type: "FeatureCollection",
    features: []
  }
};

const applyUpdates = (
  photos: PhotosContainer,
  updates: RealtimeUpdate[]
): PhotosContainer => {
  const updatedFeaturesDict = _.reduce(
    updates,
    (featuresDict, update) => {
      var updated;
      switch (update.type) {
        case "added":
        case "modified":
          updated = featuresDict.set(
            update.photo.id,
            photoToFeature(update.photo)
          );
          break;
        case "removed":
          updated = featuresDict.remove(update.photo.id);
          break;
      }
      return updated;
    },
    photos.featuresDict
  );
  return {
    featuresDict: updatedFeaturesDict,
    geojson: {
      type: "FeatureCollection",
      features: Array.from(updatedFeaturesDict.values())
    }
  };
};

export const usePhotos = (): [PhotosContainer, () => void] => {
  const location = useLocation();
  const [photos, setPhotos] = useState<PhotosContainer>(EMPTY);
  const user = useUser();
  useAsyncEffect(async () => {
    // set up realtime subscription to our own photos

    // use the local one if we have them: faster boot.
    try {
      const cached = await localforage.getItem("cachedGeoJson");
      if (cached) {
        setPhotos((current) =>
          merge(current, geojsonToPhotosContainer(cached as Geojson))
        );
      } else {
        const photosList = await dbFirebase.fetchPhotos();
        setPhotos((current) =>
          merge(current, photosToPhotosContainer(photosList))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const updates = new Rx.Subject<RealtimeUpdate>();
    dbFirebase.ownPhotosRT(user.id, (update) => updates.next(update));

    // buffer updates to collapse 500ms of realtime updates so that we don't
    // repeatedly refresh the photos list (its very large)
    updates.pipe(bufferTime(500)).subscribe((updates) => {
      setPhotos((current) => applyUpdates(current, updates));
    });
  }, [user]);

  const reload = useCallback(() => {
    setPhotos(EMPTY);
    dbFirebase.fetchPhotos().then((photosList) => {
      setPhotos((current) =>
        merge(current, photosToPhotosContainer(photosList))
      );
    });
  }, [setPhotos]);

  return [photos, reload];
};
