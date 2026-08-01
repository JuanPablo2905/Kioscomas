let dataStorageMutation = Promise.resolve();

// Local saves and cloud acknowledgements touch the same `datos` document.
// Serializing those short transactions prevents rapid sales from committing
// snapshots out of order.
export function withDataStorageLock(task) {
  const pending = dataStorageMutation.then(task, task);
  dataStorageMutation = pending.catch(() => {});
  return pending;
}
