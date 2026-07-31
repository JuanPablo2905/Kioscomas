const browserStorage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? null : { value };
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  async delete(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

const hasClaudeStorage =
  typeof window !== "undefined" &&
  typeof window.storage?.get === "function" &&
  typeof window.storage?.set === "function" &&
  typeof window.storage?.delete === "function";

export const storage = hasClaudeStorage ? window.storage : browserStorage;
