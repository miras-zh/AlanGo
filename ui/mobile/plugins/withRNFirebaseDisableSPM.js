// react-native-firebase v22+ resolves the native firebase-ios-sdk through Swift
// Package Manager. With `use_frameworks! :linkage => :static` — which
// @react-native-firebase/app forces on Expo so Firebase links correctly — each
// rnfirebase pod embeds its own SPM copy of firebase-ios-sdk, and those copies
// collide at link time ("SPM + static linkage is not supported",
// duplicate-symbol errors). `expo prebuild --clean` regenerates the Podfile and
// re-exposes this.
//
// Podfile globals for a clean `expo prebuild` with react-native-firebase, used
// together with `useFrameworks: "static"` (set in app.json's expo-build-properties):
//
//  1. `$RNFirebaseDisableSPM = true` — opt out of SPM so the pods use the
//     CocoaPods spec of firebase-ios-sdk (the long-standing, well-tested path).
//     Without it, each rnfirebase pod embeds its own SPM copy and they collide
//     under static linkage ("SPM + static linkage is not supported").
//  2. `$RNFirebaseAsStaticFramework = true` — build the rnfirebase pods as static
//     frameworks, matching `use_frameworks! :linkage => :static`.
//
// Inserted after the `platform :ios` line, before the target block.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

const FLAG = "$RNFirebaseDisableSPM = true\n$RNFirebaseAsStaticFramework = true";

module.exports = function withRNFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (contents.includes("$RNFirebaseDisableSPM")) {
        return cfg; // already set
      }
      const platformLine = /^(platform :ios[^\n]*\n)/m;
      if (!platformLine.test(contents)) {
        throw new Error(
          "withRNFirebaseDisableSPM: could not find the `platform :ios` line in the Podfile. " +
            "The Expo template changed; update plugins/withRNFirebaseDisableSPM.js."
        );
      }
      contents = contents.replace(platformLine, `$1\n${FLAG}\n`);
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
};
