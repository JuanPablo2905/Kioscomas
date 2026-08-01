const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const finiteNumber = (value) => value !== "" && value != null && Number.isFinite(Number(value));
const additiveProductFields = new Set(["deposito", "vitrina"]);

const signature = (item) => item?.id != null ? `id:${item.id}` : JSON.stringify(item);

// Product history is an event log. A device may temporarily have an older
// prefix while another device has already appended entries, so requiring an
// exact common prefix creates false conflicts during rapid sales. Preserve the
// server order and append every local event that is not there yet.
export function mergeAppendOnlyArray(local, remote) {
  if (!Array.isArray(local) || !Array.isArray(remote)) return null;
  const merged = [...remote];
  const known = new Set(remote.map(signature));
  for (const item of local) {
    const itemSignature = signature(item);
    if (!known.has(itemSignature)) {
      known.add(itemSignature);
      merged.push(item);
    }
  }
  return merged;
}

export function mergeConcurrentEntity(operation, serverValue) {
  if (operation?.type !== "entity_upsert" || !operation.baseValue || !operation.value || !serverValue) {
    return { value: null, reason: "missing_base", conflictingFields: [] };
  }
  const base = operation.baseValue;
  const local = operation.value;
  const remote = serverValue;
  const merged = { ...remote };
  const conflictingFields = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);

  for (const key of keys) {
    if (key === "_syncVersion") continue;
    const localChanged = !sameValue(local[key], base[key]);
    if (!localChanged) continue;
    const remoteChanged = !sameValue(remote[key], base[key]);

    // Stock is a quantity, not a last-write-wins value. Always apply the local
    // delta over the latest server quantity. This remains correct if five sales
    // are compacted into one pending operation.
    if (
      operation.entity === "products"
      && additiveProductFields.has(key)
      && finiteNumber(base[key])
      && finiteNumber(local[key])
      && finiteNumber(remote[key])
    ) {
      const localDelta = Number(local[key]) - Number(base[key]);
      merged[key] = Math.max(0, Number(remote[key]) + localDelta);
      continue;
    }

    if (operation.entity === "products" && key === "historial") {
      const mergedHistory = mergeAppendOnlyArray(local[key], remote[key]);
      if (mergedHistory) {
        merged[key] = mergedHistory;
        continue;
      }
    }

    if (!remoteChanged || sameValue(local[key], remote[key])) {
      if (Object.prototype.hasOwnProperty.call(local, key)) merged[key] = local[key];
      else delete merged[key];
      continue;
    }

    conflictingFields.push(key);
  }

  return conflictingFields.length
    ? { value: null, reason: "concurrent_fields", conflictingFields }
    : { value: merged, reason: null, conflictingFields: [] };
}

export function isSameEntity(left, right) {
  return left?.entity === right?.entity && String(left?.entityId) === String(right?.entityId);
}
