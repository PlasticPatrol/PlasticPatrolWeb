import React, { useState, useEffect } from "react";
import { Route, useHistory } from "react-router";

import { makeStyles } from "@material-ui/core/styles";
import { Button } from "@material-ui/core";

import { linkToUploadPhotoDialog } from "routes/photo/routes/categorise/links";
import { linkToNewPhoto } from "routes/photo/routes/new/links";
import { linkToGeotag } from "routes/photo/routes/geotag/links";

import { useGPSLocation } from "providers/LocationProvider";

import UploadPhotoDialog from "pages/photo/components/UploadPhotoDialog";
import {
  usePhotoPageState,
  usePhotoPageDispatch,
  setMetaData
} from "pages/photo/state";
import {
  isBrowserImageState,
  isImageMetaState,
  isCordovaImageState
} from "pages/photo/state/types";

import useEffectOnMount from "hooks/useEffectOnMount";

import { Item } from "../../types";
import AddNewItem from "../../components/AddNewItem/AddNewItem";
import ItemOverviewList from "../../components/ItemOverviewList/ItemOverviewList";

import loadPhoto from "./utils";

import BarcodeScanner, {
  isProductInfo
} from "pages/photo/components/BarcodeScanner";

const useStyles = makeStyles((theme) => ({
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: theme.spacing(1),
    boxSizing: "border-box"
  },
  img: {
    minHeight: "50%",
    height: "50%",
    width: "100%",
    alignSelf: "center",
    marginBottom: theme.spacing(1)
  },
  prompt: { textAlign: "center" },
  button: {
    minHeight: "2em",
    marginTop: "auto",
    textTransform: "none",
    width: "max-content",
    alignSelf: "center",
    padding: `${theme.spacing(0.25)}px ${theme.spacing(4)}px`
  },
  link: {
    color: theme.palette.secondary.main
  },
  or: {
    opacity: "50%",
    textAlign: "center",
    margin: 0
  },
  scanButton: {
    alignSelf: "center"
  }
}));

export default function CategoriseLitterPage() {
  const state = usePhotoPageState();
  const dispatch = usePhotoPageDispatch();

  const history = useHistory();
  const gpsLocation = useGPSLocation();

  useEffectOnMount(() => {
    if (isImageMetaState(state)) {
      // do nothing - this should only be set when coming back from the geotag page
    } else if (isCordovaImageState(state)) {
      const { file, fromCamera } = state;
      loadPhoto({
        fileOrFileName: file.filename,
        fromCamera,
        gpsLocation,
        cordovaMetadata: JSON.parse(file.json_metadata),
        callback: (metadata) => dispatch(setMetaData(metadata))
      });
    } else if (isBrowserImageState(state)) {
      const { file, fromCamera } = state;
      loadPhoto({
        fileOrFileName: file,
        fromCamera,
        gpsLocation,
        callback: (metadata) => dispatch(setMetaData(metadata))
      });
    } else {
      history.push(linkToNewPhoto());
    }
  });

  return <CategoriseLitterPageWithFileInfo />;
}

export function CategoriseLitterPageWithFileInfo() {
  const history = useHistory();
  const state = usePhotoPageState();

  useEffect(() => {
    if (isImageMetaState(state) && !state.imgLocation) {
      history.replace(linkToGeotag());
    }
  }, [state, history]);

  const styles = useStyles();
  const [addingNewItem, setAddingNewItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, itemIndex) => itemIndex !== index);

    setItems(newItems);
  };

  const addNewItem = (item: Item) => {
    const newItems = [...items, item];
    setItems(newItems);
    setAddingNewItem(false);
    setEditingItem(null);
  };

  const handleEditItemClick = (index: number) => {
    const itemToEdit = items[index];
    setEditingItem(itemToEdit);
  };

  const editItem = (item: Item) => {
    const index = editingItem && items.indexOf(editingItem);
    // if item doesn't exist returns -1, in theory shouldn't ever happen
    if (index !== null && index !== -1) {
      const newItems = items;
      newItems[index] = item;
      setItems(newItems);
      setEditingItem(null);
    } else {
      throw new Error("no item to edit");
    }
  };

  const isCordova = !!window.cordova;

  return (
    <>
      <div className={styles.wrapper}>
        <img
          src={isImageMetaState(state) ? state.imgSrc : ""}
          className={styles.img}
          onClick={() => setAddingNewItem(true)}
          alt=""
        ></img>
        {addingNewItem ? (
          <AddNewItem
            onCancelClick={() => setAddingNewItem(false)}
            onConfirmClick={addNewItem}
          />
        ) : editingItem ? (
          <AddNewItem
            onCancelClick={() => setEditingItem(null)}
            onConfirmClick={editItem}
            initialItem={editingItem}
          />
        ) : (
          <>
            <p className={styles.prompt}>
              Tap on a piece of litter in your photo and add details
            </p>
            {isCordova && (
              <>
                <p className={styles.or}>or</p>
                <BarcodeScanner
                  className={styles.scanButton}
                  onResult={(result) => {
                    if (isProductInfo(result)) {
                      addNewItem({
                        quantity: 1,
                        brand: result.brand,
                        type: { label: result.productName, leafKey: null },
                        barcode: result.barcode
                      });
                    } else {
                      alert(result);
                    }
                  }}
                />
              </>
            )}
            <ItemOverviewList
              items={items}
              handleRemoveItem={handleRemoveItem}
              handleItemClick={handleEditItemClick}
            />
          </>
        )}
        {!(addingNewItem || editingItem) && (
          <Button
            disabled={items.length === 0}
            variant="contained"
            color="primary"
            className={styles.button}
            onClick={() => history.push(linkToUploadPhotoDialog())}
          >
            Submit Collection
          </Button>
        )}
      </div>

      <Route path={linkToUploadPhotoDialog()}>
        <UploadPhotoDialog
          imgSrc={isImageMetaState(state) ? state.imgSrc : ""}
          online
          items={items}
          imgLocation={isImageMetaState(state) ? state.imgLocation : null}
        />
      </Route>
    </>
  );
}
