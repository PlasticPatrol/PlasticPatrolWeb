#!/bin/sh

set -x;

# TODO: config per environment
cp ./src/features/firebase/config.json functions/

# any better way ???? it muast be inserted in the HEAD as first thing
cp node_modules/first-input-delay/dist/first-input-delay.min.js  public/

VERSION_MAYOR=$(echo $npm_package_version| cut -d'.' -f 1)
VERSION_MINOR=$(echo $npm_package_version| cut -d'.' -f 2)

export REACT_APP_BUILD_NUMBER=${TRAVIS_BUILD_NUMBER:-"0"}
export REACT_APP_VERSION="$VERSION_MAYOR.$VERSION_MINOR.$REACT_APP_BUILD_NUMBER"
export REACT_APP_TITLE=$npm_package_title

eval $@
set +x;
ls public
