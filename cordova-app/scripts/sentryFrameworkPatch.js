const fs = require("fs");
const path = require("path");
const xcode = require("xcode");

const shellScript = `
APP_PATH="\${TARGET_BUILD_DIR}/\${WRAPPER_NAME}"

# This script loops through the frameworks embedded in the application and
# removes unused architectures.
find "$APP_PATH" -name '*.framework' -type d | while read -r FRAMEWORK
do
FRAMEWORK_EXECUTABLE_NAME=$(defaults read "$FRAMEWORK/Info.plist" CFBundleExecutable)
FRAMEWORK_EXECUTABLE_PATH="$FRAMEWORK/$FRAMEWORK_EXECUTABLE_NAME"
echo "Executable is $FRAMEWORK_EXECUTABLE_PATH"

EXTRACTED_ARCHS=()

for ARCH in $ARCHS
do
echo "Extracting $ARCH from $FRAMEWORK_EXECUTABLE_NAME"
lipo -extract "$ARCH" "$FRAMEWORK_EXECUTABLE_PATH" -o "$FRAMEWORK_EXECUTABLE_PATH-$ARCH"
EXTRACTED_ARCHS+=("$FRAMEWORK_EXECUTABLE_PATH-$ARCH")
done

echo "Merging extracted architectures: \${ARCHS}"
lipo -o "$FRAMEWORK_EXECUTABLE_PATH-merged" -create "\${EXTRACTED_ARCHS[@]}"
rm "\${EXTRACTED_ARCHS[@]}"

echo "Replacing original executable with thinned version"
rm "$FRAMEWORK_EXECUTABLE_PATH"
mv "$FRAMEWORK_EXECUTABLE_PATH-merged" "$FRAMEWORK_EXECUTABLE_PATH"

done
`;

module.exports = (context) => {
  try {
    const projectDir = path.resolve(context.opts.projectRoot, "platforms/ios");
    const dirContent = fs.readdirSync(projectDir);
    const matchingProjectFiles = dirContent.filter((filePath) =>
      /.*\.xcodeproj/gi.test(filePath)
    );
    const projectPath = path.join(
      projectDir,
      matchingProjectFiles[0],
      "project.pbxproj"
    );

    const project = xcode.project(projectPath);

    project.parse((error) => {
      if (error) {
        console.error("Failed to parse project", error);
        process.exit(1);
      }
      const options = {
        shellPath: "/bin/sh",
        shellScript,
        inputPaths: ['"$(BUILT_PRODUCTS_DIR)/$(INFOPLIST_PATH)"']
      };
      project.addBuildPhase(
        [],
        "PBXShellScriptBuildPhase",
        "Remove Unused Architectures",
        project.getFirstTarget().uuid,
        options
      );
      fs.writeFileSync(projectPath, project.writeSync());
    });
  } catch (error) {
    // console.debug(error);
    console.log("sentry hook didn't work :( ");
  }
};
