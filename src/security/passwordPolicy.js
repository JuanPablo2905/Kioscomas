export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordPolicyError(password) {
  const value = String(password ?? "");
  if (value.length < PASSWORD_MIN_LENGTH) return `Usá al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (value.length > PASSWORD_MAX_LENGTH) return `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (!value.trim()) return "La contraseña no puede contener solamente espacios.";
  return "";
}

export const passwordPolicyHint = `Entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres. También podés usar una frase fácil de recordar.`;
