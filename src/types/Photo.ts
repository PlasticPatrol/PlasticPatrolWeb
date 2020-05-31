import { LatLong } from "types/GPSLocation";

type Photo = {
  id: any;
  main: any;
  thumbnail: any;
  updated: any;
  moderated: any;
  owner_id: string;
  pieces: number;
};

export type FilePath = string;

export type CordovaImageMetadata = any;

export type ImageMetadata = {
  imgSrc: any;
  imgExif: any;
  imgLocation: LatLong | "not online" | "unable to extract from file";
  imgIptc: any;
};

export type CordovaFileState = {
  filePath: FilePath;
  cordovaMetadata: CordovaImageMetadata;
  fromCamera: boolean;
};

export type BrowserFileState = {
  file: File;
  fromCamera: boolean;
};

export type FileState = CordovaFileState | BrowserFileState;

export function isCordovaFileState(
  fileState: FileState
): fileState is CordovaFileState {
  return (fileState as CordovaFileState).filePath !== undefined;
}

export type CordovaCameraImage = {
  filename: string;
  json_metadata: string;
};

export function isCordovaCameraImage(
  file: File | CordovaCameraImage
): file is CordovaCameraImage {
  return (file as CordovaCameraImage).filename !== undefined;
}

export default Photo;
