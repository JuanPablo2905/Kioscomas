const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase().slice(0, 254);

export const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  return email.length >= 6
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
};

const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const safeUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch { return ""; }
};

const EMAIL_HEADER_URL = "https://kioscomas.ar/email-assets/cabecera-correo-petroleo-1200x420.png";

const emailLayout = ({ preview, category = "Información de tu cuenta", title, greeting, paragraphs = [], actionLabel = "", actionUrl = "", footnote = "", contactEmail = "" }) => {
  const safeActionUrl = safeUrl(actionUrl);
  const paragraphHtml = paragraphs.map((paragraph) => `<p class="email-copy" style="margin:0 0 16px;color:#514a42!important;-webkit-text-fill-color:#514a42;font-size:16px;line-height:1.65">${escapeHtml(paragraph)}</p>`).join("");
  const actionHtml = safeActionUrl && actionLabel
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 24px"><tr><td bgcolor="#B8412F" style="border-radius:9px;background-color:#B8412F!important"><a class="email-button" href="${escapeHtml(safeActionUrl)}" style="display:inline-block;padding:15px 23px;color:#ffffff!important;-webkit-text-fill-color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:1.2;border-radius:9px">${escapeHtml(actionLabel)}</a></td></tr></table>`
    : "";
  return `<!doctype html>
<html lang="es"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    body, table, td, a, p, h1 { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 620px) {
      .email-outer { padding: 0!important; }
      .email-shell { border-radius: 0!important; }
      .email-heading { padding: 30px 24px 10px!important; }
      .email-content { padding: 12px 24px 30px!important; }
      .email-card { padding: 25px 22px!important; }
      .email-title { font-size: 29px!important; }
      .email-button { display: block!important; text-align: center!important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-page { background-color: #e9ece9!important; }
      .email-shell, .email-paper, .email-heading, .email-content { background-color: #F6F1E7!important; }
      .email-card { background-color: #ffffff!important; }
      .email-title, .email-greeting { color: #1C4A44!important; -webkit-text-fill-color: #1C4A44!important; }
      .email-copy { color: #514a42!important; -webkit-text-fill-color: #514a42!important; }
      .email-note { background-color: #eef4f1!important; color: #355d56!important; -webkit-text-fill-color: #355d56!important; }
      .email-footer { background-color: #1C4A44!important; color: #d8e4df!important; -webkit-text-fill-color: #d8e4df!important; }
      .email-footer a { color: #F6F1E7!important; -webkit-text-fill-color: #F6F1E7!important; }
    }
  </style>
</head>
<body class="email-page" bgcolor="#e9ece9" style="margin:0;padding:0;background-color:#e9ece9!important;font-family:Arial,Helvetica,sans-serif;color:#2A241E">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preview)}&#847; &zwnj;&nbsp;&#847; &zwnj;&nbsp;&#847;</div>
  <table class="email-page" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#e9ece9" style="width:100%;background-color:#e9ece9!important"><tr><td class="email-outer" align="center" style="padding:28px 12px">
    <table class="email-shell email-paper" role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#F6F1E7" style="width:100%;max-width:600px;border-collapse:separate;overflow:hidden;border:1px solid #d8ded9;border-radius:18px;background-color:#F6F1E7!important">
      <tr><td bgcolor="#1C4A44" style="background-color:#1C4A44!important;line-height:0"><img src="${EMAIL_HEADER_URL}" width="600" alt="Kiosco+" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none"></td></tr>
      <tr><td class="email-heading email-paper" bgcolor="#F6F1E7" style="padding:38px 38px 12px;background-color:#F6F1E7!important">
        <p style="margin:0 0 10px;color:#B8412F!important;-webkit-text-fill-color:#B8412F;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">${escapeHtml(category)}</p>
        <h1 class="email-title" style="margin:0;color:#1C4A44!important;-webkit-text-fill-color:#1C4A44;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.14;font-weight:700">${escapeHtml(title)}</h1>
      </td></tr>
      <tr><td class="email-content email-paper" bgcolor="#F6F1E7" style="padding:14px 38px 34px;background-color:#F6F1E7!important">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;background-color:#ffffff!important;border:1px solid #e4ded2;border-radius:14px">
          <tr><td class="email-card" bgcolor="#ffffff" style="padding:30px;background-color:#ffffff!important">
            <p class="email-greeting" style="margin:0 0 18px;color:#1C4A44!important;-webkit-text-fill-color:#1C4A44;font-size:16px;line-height:1.65"><strong>${escapeHtml(greeting)}</strong></p>
            ${paragraphHtml}${actionHtml}
            ${footnote ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef4f1" style="width:100%;margin-top:4px;background-color:#eef4f1!important;border-left:4px solid #E3A23C;border-radius:8px"><tr><td class="email-note" bgcolor="#eef4f1" style="padding:15px 16px;background-color:#eef4f1!important;color:#355d56!important;-webkit-text-fill-color:#355d56;font-size:13px;line-height:1.55">${escapeHtml(footnote)}</td></tr></table>` : ""}
            <p class="email-copy" style="margin:24px 0 0;color:#514a42!important;-webkit-text-fill-color:#514a42;font-size:15px;line-height:1.6">Saludos,<br><strong style="color:#1C4A44!important;-webkit-text-fill-color:#1C4A44">El equipo de Kiosco+</strong></p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td class="email-footer" align="center" bgcolor="#1C4A44" style="padding:23px 30px 28px;background-color:#1C4A44!important;color:#d8e4df!important;-webkit-text-fill-color:#d8e4df">
        <p style="margin:0 0 8px;font-size:13px;line-height:1.5">Gestión simple para comercios reales.</p>
        <p style="margin:0;font-size:12px;line-height:1.6"><a href="https://kioscomas.ar" style="color:#F6F1E7!important;-webkit-text-fill-color:#F6F1E7;text-decoration:none;font-weight:700">kioscomas.ar</a>${isValidEmail(contactEmail) ? `<span style="color:#E3A23C!important;-webkit-text-fill-color:#E3A23C;padding:0 7px">•</span><a href="mailto:${escapeHtml(contactEmail)}" style="color:#F6F1E7!important;-webkit-text-fill-color:#F6F1E7;text-decoration:none">${escapeHtml(contactEmail)}</a>` : ""}</p>
        <p style="margin:13px 0 0;color:#adc4bc!important;-webkit-text-fill-color:#adc4bc;font-size:11px;line-height:1.55">Este es un correo de seguridad o de servicio. Si no reconocés la actividad, respondé a este mensaje para pedir ayuda.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
};

const textVersion = ({ greeting, paragraphs = [], actionLabel = "", actionUrl = "", footnote = "" }) => [
  greeting,
  ...paragraphs,
  actionLabel && actionUrl ? `${actionLabel}: ${actionUrl}` : "",
  footnote,
  "Kiosco+ — Tu negocio, bajo control",
].filter(Boolean).join("\n\n");

export function createEmailService({ apiKey, from, replyTo = "", appUrl, fetchImpl = globalThis.fetch, testMode = false } = {}) {
  const configuredApiKey = String(apiKey || "").trim();
  const configuredFrom = String(from || "").trim();
  const configuredReplyTo = normalizeEmail(replyTo);
  const configuredAppUrl = safeUrl(appUrl) || "https://app.kioscomas.ar/";
  const configured = testMode || Boolean(configuredApiKey && configuredFrom);

  const send = async ({ to, subject, preview, category, title, greeting, paragraphs, actionLabel, actionUrl, footnote, idempotencyKey }) => {
    const recipient = normalizeEmail(to);
    if (!isValidEmail(recipient)) throw new Error("email_recipient_invalid");
    if (!configured) throw new Error("email_delivery_not_configured");
    const content = { preview, category, title, greeting, paragraphs, actionLabel, actionUrl, footnote, contactEmail: configuredReplyTo };
    if (testMode) return { id: `test-${String(idempotencyKey || "email").slice(0, 80)}`, test: true, to: recipient };
    const payload = {
      from: configuredFrom,
      to: [recipient],
      subject: String(subject || "Kiosco+").slice(0, 180),
      html: emailLayout(content),
      text: textVersion(content),
      ...(configuredReplyTo ? { reply_to: configuredReplyTo } : {}),
    };
    const requestOptions = {
      method: "POST",
      headers: {
        authorization: `Bearer ${configuredApiKey}`,
        "content-type": "application/json",
        "idempotency-key": String(idempotencyKey || `kiosco-${Date.now()}`).slice(0, 256),
      },
      body: JSON.stringify(payload),
    };
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetchImpl(RESEND_ENDPOINT, { ...requestOptions, signal: AbortSignal.timeout(10_000) });
        const detail = await response.json().catch(() => ({}));
        if (response.ok) return detail;
        const error = new Error(detail?.message || detail?.error || `resend_${response.status}`);
        error.status = response.status;
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } catch (error) {
        lastError = error;
        if (error?.status && error.status < 500 && error.status !== 429) throw error;
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw lastError || new Error("resend_unavailable");
  };

  return {
    configured,
    appUrl: configuredAppUrl,
    sendPasswordReset: ({ to, name, resetUrl, expiresInMinutes, requestId }) => send({
      to,
      subject: "Creá una nueva contraseña para Kiosco+",
      preview: "Recibimos una solicitud para restablecer tu acceso.",
      category: "Seguridad de tu cuenta",
      title: "Creá una nueva contraseña",
      greeting: `Hola ${name || ""}`.trim(),
      paragraphs: ["Recibimos una solicitud para cambiar la contraseña de tu cuenta.", "Tu contraseña actual no se envía por correo y seguirá funcionando hasta que completes este cambio."],
      actionLabel: "Crear una nueva contraseña",
      actionUrl: resetUrl,
      footnote: `Este enlace funciona una sola vez y vence en ${expiresInMinutes} minutos. Si no pediste el cambio, ignorá este correo.`,
      idempotencyKey: `password-reset/${requestId}`,
    }),
    sendWelcome: ({ to, name, businessName, accountId }) => send({
      to,
      subject: "Recibimos tu solicitud de Kiosco+",
      preview: "Tu cuenta fue creada y está esperando la habilitación.",
      category: "Nueva cuenta",
      title: "¡Bienvenido a Kiosco+!",
      greeting: `Hola ${name || ""}`.trim(),
      paragraphs: [`Recibimos la solicitud para ${businessName || "tu negocio"}.`, "La cuenta quedó guardada y te avisaremos cuando esté habilitada para empezar a trabajar."],
      actionLabel: "Abrir Kiosco+",
      actionUrl: configuredAppUrl,
      footnote: "Guardá este correo como referencia. Nunca te enviaremos una contraseña por email.",
      idempotencyKey: `welcome/${accountId}`,
    }),
    sendAccountReady: ({ to, name, businessName, accountId, eventId }) => send({
      to,
      subject: "Tu cuenta de Kiosco+ ya está habilitada",
      preview: "Ya podés ingresar y empezar a trabajar.",
      category: "Tu cuenta",
      title: "Tu cuenta ya está lista",
      greeting: `Hola ${name || ""}`.trim(),
      paragraphs: [`La cuenta de ${businessName || "tu negocio"} fue habilitada.`, "Ingresá con tu usuario y la contraseña que elegiste al registrarte."],
      actionLabel: "Ingresar a Kiosco+",
      actionUrl: configuredAppUrl,
      footnote: "Si ingresás desde un dispositivo nuevo, primero necesitarás una clave de activación.",
      idempotencyKey: `account-ready/${accountId}/${eventId}`,
    }),
    sendPasswordChanged: ({ to, name, requestId }) => send({
      to,
      subject: "Tu contraseña de Kiosco+ fue actualizada",
      preview: "Confirmación de cambio de contraseña.",
      category: "Seguridad de tu cuenta",
      title: "Contraseña actualizada",
      greeting: `Hola ${name || ""}`.trim(),
      paragraphs: ["La contraseña de tu cuenta se cambió correctamente.", "Por seguridad cerramos las sesiones anteriores. Ya podés ingresar nuevamente con la contraseña nueva."],
      actionLabel: "Volver a Kiosco+",
      actionUrl: configuredAppUrl,
      footnote: "Si no realizaste este cambio, contactanos inmediatamente respondiendo este correo.",
      idempotencyKey: `password-changed/${requestId}`,
    }),
  };
}
