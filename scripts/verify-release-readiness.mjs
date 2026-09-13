import fs from "node:fs";
import process from "node:process";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const notes = JSON.parse(fs.readFileSync("release-notes/releases.json", "utf8"));
const failures = [];
const ok = (condition, message) => condition ? console.log(`OK: ${message}`) : failures.push(message);

ok(notes[0]?.version === pkg.version, "las notas corresponden a package.json");
ok(fs.existsSync("electron-builder.store.cjs"), "la configuración de Microsoft Store existe");
ok(fs.existsSync("electron-builder.mac.cjs"), "la firma/notarización de Mac está configurada");
ok(["StoreLogo.png", "Square44x44Logo.png", "Square150x150Logo.png", "Wide310x150Logo.png", "LargeTile.png", "SmallTile.png", "SplashScreen.png"].every((file) => fs.existsSync(`build/appx/${file}`)), "los recursos visuales de Microsoft Store existen");
ok(fs.existsSync("build/entitlements.mac.plist") && fs.existsSync("build/entitlements.mac.inherit.plist"), "los permisos de firma de Mac existen");
ok(fs.existsSync("android/app/build.gradle"), "el proyecto Android existe");
ok(fs.existsSync("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png") && fs.existsSync("android/app/src/main/res/drawable-port-xxxhdpi/splash.png"), "los recursos visuales de Android existen");
ok(fs.existsSync("docs/PUBLICAR_EN_GOOGLE_PLAY.md"), "la guía de Google Play existe");

if (process.argv.includes("--mac-production")) {
  ["CSC_LINK", "CSC_KEY_PASSWORD", "APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"].forEach((name) => ok(Boolean(process.env[name]), `Mac tiene ${name}`));
}
if (process.argv.includes("--microsoft-store")) {
  ["MICROSOFT_STORE_IDENTITY_NAME", "MICROSOFT_STORE_PUBLISHER", "MICROSOFT_STORE_PUBLISHER_DISPLAY_NAME"].forEach((name) => ok(Boolean(process.env[name]), `Microsoft Store tiene ${name}`));
}
if (process.argv.includes("--google-play")) {
  ["ANDROID_KEYSTORE_PATH", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"].forEach((name) => ok(Boolean(process.env[name]), `Android tiene ${name}`));
  const keystorePath = process.env.ANDROID_KEYSTORE_PATH;
  ok(Boolean(keystorePath && fs.existsSync(keystorePath) && fs.statSync(keystorePath).size > 0), "la clave de firma Android existe y no está vacía");
}
if (failures.length) {
  console.error(`\nFaltan ${failures.length} requisito(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`\nKiosco+ ${pkg.version}: preparación de lanzamiento correcta.`);
