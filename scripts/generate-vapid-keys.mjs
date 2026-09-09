import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("Creá estas variables en Render > kiosco-plus-api > Environment:\n");
console.log(`KIOSCO_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`KIOSCO_VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("KIOSCO_VAPID_SUBJECT=mailto:soporte@kioscomas.ar");
console.log("\nLa clave privada se configura sólo en Render: nunca la subas a GitHub.");
