#!/bin/sh

pushd cordova-app

# this is used for travis and will eventually be removed

# tar cvf secrets.tar build.json *.cer *.p12 *.mobileprovision *.jks GoogleService-Info.plist google-services.json GooglePlayAndroidDeveloper.json
# travis encrypt-file secrets.tar secrets.tar.enc -p -r Geovation/plastic-patrol

# this is used for github
# make sure that $ENC_PASSWORD is in github
tar cvf secrets.tar build.json *.cer *.p12 *.mobileprovision *.jks GoogleService-Info.plist google-services.json GooglePlayAndroidDeveloper.json
openssl enc -aes-256-cbc -in secrets.tar -out secrets.tar.encrypted -k $ENC_PASSWORD -md sha512

# echo you should run this command
# echo "cp secrets.tar ../secrets/plastic-patrol.tar"

popd
