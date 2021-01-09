import { useState } from "react";
import { useHistory } from "react-router-dom";

import firebase from "firebase/app";

import { dbFirebase } from "features/firebase";
import { gtagEvent } from "gtag.js";
import { Item } from "pages/photo/types";

import { linkToUploadSuccess } from "routes/upload-success/links";
import useEffectOnMount from "hooks/useEffectOnMount";

type HookArgs = {
  imgSrc: string;
  online?: boolean;
  imgLocation: any;
  items: Item[];
  onSuccess?: (n: number) => void;
  onCancelUpload: () => void;
};

type Args = {
  setSendingProgress: (progress: number) => void;
  setUploadTask: (task: any) => void;
  history: any;
} & HookArgs;

export default function useSendFile(args: HookArgs) {
  const [uploadTask, setUploadTask] = useState<any>();
  const [sendingProgress, setSendingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>();
  const history = useHistory();

  const sendFileFunc = async () => {
    try {
      await sendFile({ ...args, setUploadTask, setSendingProgress, history });
    } catch (err) {
      setErrorMessage(err.message);
    }
  };
  const cancelUpload = () => {
    uploadTask && uploadTask.cancel();
    history.goBack();
  };

  useEffectOnMount(sendFileFunc);

  return {
    sendFile: sendFileFunc,
    sendingProgress,
    cancelUpload,
    errorMessage,
    closeErrorDialog: () => setErrorMessage(undefined)
  };
}

async function sendFile({
  imgSrc,
  online,
  imgLocation,
  items,
  history,
  setSendingProgress,
  setUploadTask,
  onCancelUpload
}: Args) {
  if (!online) {
    throw new Error(
      "It appears you're offline, please turn on your data or wifi to upload this photo"
    );
  }

  gtagEvent("Upload", "Photo");

  let totalCount: number = 0;
  const transformedItems = items.map(({ quantity, type, brand, barcode }) => {
    totalCount = totalCount + quantity;
    return {
      brand,
      barcode: barcode || null,
      number: quantity,
      leafkey: type && type.leafKey,
      label: type && type.label
    };
  });

  const dataToSend = {
    ...imgLocation,
    pieces: totalCount,
    categories: transformedItems
  };

  let photoRef;
  try {
    photoRef = await dbFirebase.saveMetadata(dataToSend);
  } catch (error) {
    console.error(error);

    const extraInfo =
      error.message === "storage/canceled"
        ? ""
        : `Try again (${error.message})`;
    throw new Error(`Photo upload was canceled. ${extraInfo}`);
  }

  const base64 = imgSrc.split(",")[1];
  const uploadTask = dbFirebase.savePhoto(photoRef.id, base64);

  setUploadTask(uploadTask);

  uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED,
    (snapshot) => {
      const sendingProgress = Math.ceil(
        (snapshot.bytesTransferred / snapshot.totalBytes) * 98 + 1
      );
      setSendingProgress(sendingProgress);

      switch (snapshot.state) {
        case firebase.storage.TaskState.PAUSED: // or 'paused'
          console.log("Upload is paused");
          break;
        case firebase.storage.TaskState.RUNNING: // or 'running'
          console.log("Upload is running");
          break;
        default:
          console.log(snapshot.state);
      }
    });

  await uploadTask.then(() => {
      history.push(linkToUploadSuccess(totalCount as any));
    }
  );

  await uploadTask.catch((error) => {
    // @ts-ignore
    if (error.code === "storage/canceled") {
      onCancelUpload();
    } else {
      console.log(error);
      const extraInfo =
        error.message === "storage/canceled"
          ? ""
          : `Try again (${error.message})`;
      throw Error(`Photo upload was canceled. ${extraInfo}`);
    }
  });
}
