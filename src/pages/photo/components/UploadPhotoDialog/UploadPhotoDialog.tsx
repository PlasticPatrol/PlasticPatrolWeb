import React from "react";

import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import LinearProgress from "@material-ui/core/LinearProgress";
import Button from "@material-ui/core/Button";

import useSendFile from "./useSendFile";

interface Props {
  imgLocation: any;
  imgSrc: any;
  online: boolean;
  items: any;
}

export default function UploadPhotoDialog({
  imgLocation,
  imgSrc,
  online,
  items
}: Props) {
  const {
    cancelUpload,
    errorMessage,
    closeErrorDialog,
    sendingProgress
  } = useSendFile({
    imgSrc,
    online,
    imgLocation,
    items
  });

  return (
    <>
      <Dialog
        open={!!errorMessage}
        onClose={closeErrorDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {errorMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeErrorDialog} color="primary">
            Ok
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!errorMessage}>
        <DialogContent className={"dialogs__contentProgress"}>
          <DialogContentText id="loading-dialog-text">
            {sendingProgress} % done. Be patient ;)
          </DialogContentText>
          <div className={"dialogs__linearProgress"}>
            <br />
            <LinearProgress
              variant="determinate"
              color="primary"
              value={sendingProgress}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelUpload} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
