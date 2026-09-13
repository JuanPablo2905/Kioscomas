const packageMetadata = require("./package.json");

const signingReady = Boolean(process.env.CSC_LINK && process.env.CSC_KEY_PASSWORD);
const notarizationReady = signingReady && Boolean(
  process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID,
);

module.exports = {
  ...packageMetadata.build,
  mac: {
    ...packageMetadata.build.mac,
    extendInfo: {
      ...(packageMetadata.build.mac?.extendInfo || {}),
      NSCameraUsageDescription: "Kiosco+ usa la cámara para escanear productos, tickets y códigos QR.",
    },
    identity: signingReady ? undefined : null,
    hardenedRuntime: signingReady,
    gatekeeperAssess: false,
    notarize: notarizationReady,
    ...(signingReady ? {
      entitlements: "build/entitlements.mac.plist",
      entitlementsInherit: "build/entitlements.mac.inherit.plist",
    } : {}),
  },
};
