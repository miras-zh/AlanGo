// iOS 27 SDK requires the UIScene lifecycle: an app built with Xcode 27 that
// still creates its window in AppDelegate crashes on launch with
// `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`.
//
// Expo SDK 57 ships the runtime side (`ExpoAppSceneDelegate`,
// `ExpoReactNativeFactoryProvider`) but its prebuild template still generates
// the old window-in-AppDelegate project. This plugin applies what the SDK 58
// template does, so a fresh `expo prebuild` yields a launchable iOS 27 app:
//   1. Info.plist: UIApplicationSceneManifest pointing at SceneDelegate
//   2. SceneDelegate.swift (subclass of ExpoAppSceneDelegate), added to the target
//   3. AppDelegate.swift: conform to ExpoReactNativeFactoryProvider and stop
//      creating the window / starting React Native (the scene delegate does it)
const fs = require("fs");
const path = require("path");
const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");

const SCENE_DELEGATE_SWIFT = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

function withSceneInfoPlist(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneDelegateFile(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(
        cfg.modRequest.projectRoot
      );
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        projectName,
        "SceneDelegate.swift"
      );
      fs.writeFileSync(file, SCENE_DELEGATE_SWIFT);
      return cfg;
    },
  ]);
}

function withSceneDelegateInXcodeProject(config) {
  return withXcodeProject(config, (cfg) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      cfg.modRequest.projectRoot
    );
    // Returns null (no-op) when the file is already part of the group.
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/SceneDelegate.swift`,
      groupName: projectName,
      project: cfg.modResults,
    });
    return cfg;
  });
}

const WINDOW_LINE = /\n[ \t]*window = UIWindow\(frame: UIScreen\.main\.bounds\)/;
const START_REACT_NATIVE = /\n[ \t]*factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)/;

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      throw new Error("withUIScene: only a Swift AppDelegate is supported");
    }
    let src = cfg.modResults.contents;
    if (src.includes("ExpoReactNativeFactoryProvider")) {
      return cfg; // already migrated
    }

    if (!WINDOW_LINE.test(src) || !START_REACT_NATIVE.test(src)) {
      throw new Error(
        "withUIScene: could not find the window/startReactNative block in AppDelegate.swift. " +
          "The Expo template changed; update plugins/withUIScene.js."
      );
    }
    src = src.replace(START_REACT_NATIVE, "");
    src = src.replace(
      WINDOW_LINE,
      "\n    // The window is created and React Native is started by `SceneDelegate` under the\n" +
        "    // scene-based life cycle (required by the iOS 27 SDK)."
    );

    const classDecl = "class AppDelegate: ExpoAppDelegate {";
    if (!src.includes(classDecl)) {
      throw new Error(
        "withUIScene: could not find `class AppDelegate: ExpoAppDelegate` in AppDelegate.swift."
      );
    }
    src = src.replace(
      classDecl,
      "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {"
    );

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withUIScene(config) {
  config = withSceneInfoPlist(config);
  config = withSceneDelegateFile(config);
  config = withSceneDelegateInXcodeProject(config);
  config = withSceneAppDelegate(config);
  return config;
};

