const packageMetadata = require("./package.json");

function requiredEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(
      `Falta ${name}. Copiá su valor desde Partner Center > Product management > Product identity antes de generar el paquete de Microsoft Store.`,
    );
  }
  return value;
}

const identityName = requiredEnvironment("MICROSOFT_STORE_IDENTITY_NAME");
const publisher = requiredEnvironment("MICROSOFT_STORE_PUBLISHER");
const publisherDisplayName = requiredEnvironment("MICROSOFT_STORE_PUBLISHER_DISPLAY_NAME");

module.exports = {
  ...packageMetadata.build,
  directories: {
    ...packageMetadata.build.directories,
    buildResources: "build",
    output: "release-store",
  },
  publish: [],
  win: {
    ...packageMetadata.build.win,
    target: ["appx"],
  },
  appx: {
    applicationId: "KioscoPlus",
    identityName,
    publisher,
    publisherDisplayName,
    displayName: "Kiosco+",
    artifactName: "KioscoPlus-Store-${version}-${arch}.${ext}",
    backgroundColor: "#F6F1E7",
    languages: ["es-AR"],
    minVersion: "10.0.19041.0",
    maxVersionTested: "10.0.26100.0",
    showNameOnTiles: false,
  },
};
