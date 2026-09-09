import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEmailService } from "../../server/email-service.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(here, "vistas-previas");
await mkdir(outputDirectory, { recursive: true });

let capturedPayload = null;
const fetchImpl = async (_url, options) => {
  capturedPayload = JSON.parse(options.body);
  return {
    ok: true,
    status: 200,
    json: async () => ({ id: "preview-email" }),
  };
};

const service = createEmailService({
  apiKey: "preview-only",
  from: "Kiosco+ <notificaciones@kioscomas.ar>",
  replyTo: "soporte@kioscomas.ar",
  appUrl: "https://app.kioscomas.ar/",
  fetchImpl,
});

const examples = [
  {
    file: "01-recuperar-contrasena.html",
    send: () => service.sendPasswordReset({
      to: "cliente@ejemplo.com",
      name: "Martín",
      resetUrl: "https://app.kioscomas.ar/?reset_token=ejemplo-seguro",
      expiresInMinutes: 30,
      requestId: "preview-reset",
    }),
  },
  {
    file: "02-solicitud-recibida.html",
    send: () => service.sendWelcome({
      to: "cliente@ejemplo.com",
      name: "Martín",
      businessName: "Almacén San Martín",
      accountId: "preview-account",
    }),
  },
  {
    file: "03-cuenta-habilitada.html",
    send: () => service.sendAccountReady({
      to: "cliente@ejemplo.com",
      name: "Martín",
      businessName: "Almacén San Martín",
      accountId: "preview-account",
      eventId: "preview-ready",
    }),
  },
  {
    file: "04-contrasena-modificada.html",
    send: () => service.sendPasswordChanged({
      to: "cliente@ejemplo.com",
      name: "Martín",
      requestId: "preview-changed",
    }),
  },
];

const links = [];
for (const example of examples) {
  capturedPayload = null;
  await example.send();
  if (!capturedPayload?.html) throw new Error(`No se generó HTML para ${example.file}`);
  const localPreviewHtml = capturedPayload.html.replace(
    "https://kioscomas.ar/email-assets/cabecera-correo-petroleo-1200x420.png",
    "../assets/cabecera-correo-petroleo-1200x420.png",
  );
  await writeFile(resolve(outputDirectory, example.file), localPreviewHtml, "utf8");
  links.push(`<li><a href="./${example.file}">${capturedPayload.subject}</a></li>`);
}

await writeFile(resolve(outputDirectory, "index.html"), `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Correos Kiosco+</title>
<style>body{max-width:760px;margin:50px auto;padding:0 22px;background:#F6F1E7;color:#2A241E;font:16px/1.6 Arial,sans-serif}h1{color:#1C4A44;font:700 42px Georgia,serif}a{color:#B8412F;font-weight:700}li{margin:14px 0}</style></head>
<body><h1>Vistas previas de correo Kiosco+</h1><p>Estas muestras fueron generadas por el mismo servicio que utiliza la API.</p><ol>${links.join("")}</ol></body></html>`, "utf8");

process.stdout.write(`Generadas ${examples.length} vistas previas en ${outputDirectory}\n`);
