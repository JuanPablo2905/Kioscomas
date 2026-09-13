import { once } from "node:events";

const wait = (milliseconds) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(false), milliseconds);
  timer.unref?.();
});

export const stopChildProcess = async (child, { graceMilliseconds = 3_000 } = {}) => {
  if (!child || child.exitCode !== null || child.signalCode) return;

  const gracefulExit = once(child, "exit").then(() => true).catch(() => true);
  child.kill("SIGTERM");
  if (await Promise.race([gracefulExit, wait(graceMilliseconds)])) return;

  if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
  await Promise.race([
    once(child, "exit").catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1_000)),
  ]);
};
