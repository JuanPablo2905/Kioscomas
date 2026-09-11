const FIELD_LABELS = {
  nombre: "Nombre",
  codigo: "Código de barras",
  costo: "Precio de costo",
  venta: "Precio de venta",
  deposito: "Stock en depósito",
  vitrina: "Stock en vitrina",
  minimo: "Stock mínimo",
  alertaVitrina: "Alerta de vitrina",
  categoria: "Categoría",
  familia: "Familia",
  variante: "Variante",
  unidad: "Unidad",
  proveedorId: "Proveedor",
  estado: "Estado",
};

const DATA_LABELS = {
  products: "productos",
  caja: "caja",
  tickets: "ventas y tickets",
  clientes: "clientes y fiado",
  comprasItems: "lista de compras",
  proveedores: "proveedores",
  perdidas: "vencimientos y pérdidas",
  sugerencias: "sugerencias",
  pedidos: "pedidos",
  gastos: "gastos",
  ventasSuspendidas: "ventas suspendidas",
  inventarios: "conteos físicos",
  cajaAbierta: "estado de caja",
  tareas: "tareas",
  metas: "metas",
  promociones: "promociones",
  reservas: "pedidos de clientes",
  presupuestos: "presupuestos",
  arqueos: "arqueos",
  configuracionFiscal: "configuración fiscal",
  comprobantes: "comprobantes",
  listaCompras: "lista de compras",
  retornables: "retornables",
  cambioCaja: "cambio de caja",
  autoconsumos: "autoconsumo",
  turnos: "turnos",
  recordatoriosProveedor: "recordatorios",
  movimientosStock: "movimientos de stock",
  labelTemplates: "distribuciones de etiquetas",
  historialLimpiezas: "limpiezas de historial",
};

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const itemName = (item) => item?.nombre || item?.producto || item?.concepto || item?.nota || item?.descripcion || (item?.id !== undefined ? `#${item.id}` : "registro");

const arrayChange = (previous = [], next = []) => {
  const oldById = new Map(previous.map((item) => [String(item?.id), item]));
  const nextById = new Map(next.map((item) => [String(item?.id), item]));
  const added = next.filter((item) => !oldById.has(String(item?.id)));
  const removed = previous.filter((item) => !nextById.has(String(item?.id)));
  const changed = next.flatMap((item) => {
    const old = oldById.get(String(item?.id));
    return old && !same(old, item) ? [{ old, item }] : [];
  });
  const received = [
    ...added.filter((item) => item?.estado === "recibido"),
    ...changed.filter(({ old, item }) => old?.estado !== "recibido" && item?.estado === "recibido").map(({ item }) => item),
  ];
  const kind = received.length ? "recibir" : added.length ? "agregar" : removed.length ? "eliminar" : "modificar";
  const touched = received.length ? received : [...added, ...removed, ...changed.map(({ item }) => item)];
  const identities = [...new Set(touched.map((item) => String(item?.productId ?? item?.id ?? itemName(item))))].sort();
  return { added, removed, changed, received, kind, identities };
};

const auditChangeMetadata = (key, previousValue, nextValue) => {
  if (key !== "comprasItems" || !Array.isArray(previousValue) || !Array.isArray(nextValue)) return {};
  const change = arrayChange(previousValue, nextValue);
  const metadata = { agrupacion: `${key}:${change.kind}:${change.identities.join(",") || "lista"}` };
  if (change.changed.length !== 1 || change.added.length || change.removed.length) return metadata;
  const [{ old, item }] = change.changed;
  if (old?.estado === item?.estado && Number(old?.cantidad) !== Number(item?.cantidad)) {
    return {
      ...metadata,
      cambioCantidad: {
        nombre: itemName(item),
        desde: Number(old?.cantidad) || 0,
        hasta: Number(item?.cantidad) || 0,
      },
    };
  }
  return metadata;
};

export function auditActor(identity) {
  const isAppAdmin = !!(identity?.adminApp && identity?.operandoNegocio);
  return {
    usuario: identity?.nombre || "Sistema",
    usuarioId: identity?.usuarioId || "sistema",
    rol: isAppAdmin ? "Administrador de la app" : (identity?.rol || "Sistema"),
    origen: isAppAdmin ? "administracion_app" : identity?.rol === "Dueño" ? "dueno" : identity ? "empleado" : "sistema",
  };
}

export function enrichEntityHistory(key, previousValue, nextValue, actor) {
  if (key !== "products" || !Array.isArray(nextValue)) return nextValue;
  const previousById = new Map((Array.isArray(previousValue) ? previousValue : []).map((item) => [String(item.id), item]));
  return nextValue.map((item) => {
    const oldIds = new Set((previousById.get(String(item.id))?.historial || []).map((entry) => String(entry.id)));
    const history = (item.historial || []).map((entry) => oldIds.has(String(entry.id)) || entry.usuario
      ? entry
      : { ...entry, ...actor, fechaIso: entry.fechaIso || new Date().toISOString() });
    return history === item.historial ? item : { ...item, historial: history };
  });
}

function describeProducts(previous, next) {
  const oldById = new Map((previous || []).map((item) => [String(item.id), item]));
  const nextById = new Map((next || []).map((item) => [String(item.id), item]));
  const added = (next || []).filter((item) => !oldById.has(String(item.id)));
  const removed = (previous || []).filter((item) => !nextById.has(String(item.id)));
  const changed = (next || []).flatMap((item) => {
    const old = oldById.get(String(item.id));
    if (!old) return [];
    const fields = Object.keys(FIELD_LABELS).filter((field) => !same(old[field], item[field]));
    if (!fields.length) return [];
    return [{ item, fields: fields.map((field) => `${FIELD_LABELS[field]}: ${String(old[field] ?? "vacío")} → ${String(item[field] ?? "vacío")}`) }];
  });
  if (added.length) return `Producto creado: ${added.map(itemName).join(", ")}`;
  if (removed.length) return `Producto eliminado: ${removed.map(itemName).join(", ")}`;
  if (changed.length === 1) return `${changed[0].item.nombre}: ${changed[0].fields.join(" · ")}`;
  if (changed.length > 1) return `${changed.length} productos modificados: ${changed.map(({ item }) => item.nombre).join(", ")}`;
  return "Productos actualizados";
}

function describeArray(label, previous, next) {
  const oldById = new Map((previous || []).map((item) => [String(item.id), item]));
  const nextById = new Map((next || []).map((item) => [String(item.id), item]));
  const added = (next || []).filter((item) => !oldById.has(String(item.id)));
  const removed = (previous || []).filter((item) => !nextById.has(String(item.id)));
  const changed = (next || []).filter((item) => {
    const old = oldById.get(String(item.id));
    return old && !same(old, item);
  });
  if (added.length) return `${label}: se agregaron ${added.map(itemName).join(", ")}`;
  if (removed.length) return `${label}: se eliminaron ${removed.map(itemName).join(", ")}`;
  if (changed.length) return `${label}: se modificaron ${changed.map(itemName).join(", ")}`;
  return `${label}: datos actualizados`;
}

function describePurchaseItems(previous, next) {
  const change = arrayChange(previous || [], next || []);
  if (change.received.length) {
    const received = change.received.map((item) => `${Math.max(1, Number(item?.cantidad) || 1)} × ${itemName(item)}`);
    return `Compra recibida: ${received.join(", ")}`;
  }
  if (change.added.length) return `Lista de compras: se ${change.added.length === 1 ? "agregó" : "agregaron"} ${change.added.map(itemName).join(", ")}`;
  if (change.removed.length) return `Lista de compras: se ${change.removed.length === 1 ? "eliminó" : "eliminaron"} ${change.removed.map(itemName).join(", ")}`;
  if (change.changed.length === 1) {
    const [{ old, item }] = change.changed;
    if (Number(old?.cantidad) !== Number(item?.cantidad)) return `Lista de compras: ${itemName(item)} · cantidad ${Number(old?.cantidad) || 0} → ${Number(item?.cantidad) || 0}`;
    return `Lista de compras: se modificó ${itemName(item)}`;
  }
  if (change.changed.length > 1) return `Lista de compras: se modificaron ${change.changed.map(({ item }) => itemName(item)).join(", ")}`;
  return "Lista de compras actualizada";
}

const goalAmount = (goal) => `$${Number(goal?.objetivo || 0).toLocaleString("es-AR")}`;
const workModeLabel = (mode) => mode === "equipo" ? "Tengo empleados" : "Trabajo solo";

export function describeAccountChange(patch = {}, previousAccount = {}) {
  const changes = [];
  if (Object.hasOwn(patch, "modoNegocio")) changes.push(`Forma de trabajo: ${workModeLabel(previousAccount.modoNegocio)} → ${workModeLabel(patch.modoNegocio)}`);
  if (Object.hasOwn(patch, "nombreNegocio")) changes.push(`Nombre del negocio: ${previousAccount.nombreNegocio || "Sin nombre"} → ${patch.nombreNegocio || "Sin nombre"}`);
  if (Object.hasOwn(patch, "imagenNegocio")) changes.push(patch.imagenNegocio ? "Imagen del negocio actualizada" : "Imagen del negocio eliminada");
  return changes.join(" · ") || "Configuración del negocio actualizada";
}

function describeGoals(previous, next) {
  const oldById = new Map((previous || []).map((item) => [String(item.id), item]));
  const nextById = new Map((next || []).map((item) => [String(item.id), item]));
  const added = (next || []).find((item) => !oldById.has(String(item.id)));
  const removed = (previous || []).find((item) => !nextById.has(String(item.id)));
  const changed = (next || []).find((item) => {
    const old = oldById.get(String(item.id));
    return old && Number(old.objetivo || 0) !== Number(item.objetivo || 0);
  });
  if (added) return `Meta diaria establecida en ${goalAmount(added)}`;
  if (changed) return `Meta diaria actualizada: ${goalAmount(oldById.get(String(changed.id)))} → ${goalAmount(changed)}`;
  if (removed) return `Meta diaria eliminada: ${goalAmount(removed)}`;
  return "Meta diaria actualizada";
}

export function describeDataChange(key, previousValue, nextValue) {
  if (key === "products") return describeProducts(previousValue, nextValue);
  if (key === "metas") return describeGoals(previousValue, nextValue);
  if (key === "comprasItems") return describePurchaseItems(previousValue, nextValue);
  if (key === "caja") {
    const oldMovements = previousValue?.movimientos || [];
    const nextMovements = nextValue?.movimientos || [];
    const newMovement = nextMovements.find((item) => !oldMovements.some((old) => String(old.id) === String(item.id)));
    if (newMovement) return `Caja: ${newMovement.nota || newMovement.tipo || "movimiento"} · $${Number(newMovement.monto || 0).toLocaleString("es-AR")}`;
    if (Number(previousValue?.saldo || 0) !== Number(nextValue?.saldo || 0)) return `Saldo de caja: $${Number(previousValue?.saldo || 0).toLocaleString("es-AR")} → $${Number(nextValue?.saldo || 0).toLocaleString("es-AR")}`;
    return "Caja actualizada";
  }
  const label = DATA_LABELS[key] || key;
  if (Array.isArray(previousValue) && Array.isArray(nextValue)) return describeArray(label, previousValue, nextValue);
  return `${label}: ${String(previousValue ?? "vacío")} → ${String(nextValue ?? "vacío")}`;
}

export function auditDisplayDetail(event, dataset = {}) {
  if (event?.accion === "inicio_sesion") return "Inicio de sesión";
  if (event?.detalle === "Configuración del negocio modificada: modoNegocio") return `Forma de trabajo: ${workModeLabel(dataset?.modoNegocio)}`;
  if (event?.recurso !== "metas") return event?.detalle || event?.accion;
  const technicalId = String(event.detalle || "").match(/#([^,\s]+)/)?.[1];
  const goal = technicalId ? (dataset.metas || []).find((item) => String(item.id) === technicalId) : null;
  return goal ? `Meta diaria establecida en ${goalAmount(goal)}` : (event.detalle || "Meta diaria actualizada");
}

export function auditDisplaySection(section) {
  return ({ configuracion: "Configuración", seguridad: "Seguridad" })[section] || section;
}

export function auditDisplayRole(event, account = {}) {
  if (event?.rol) return event.rol;
  const eventUser = String(event?.usuario || "").trim().toLocaleLowerCase("es");
  const owner = String(account?.nombre || "").trim().toLocaleLowerCase("es");
  if (eventUser && owner && eventUser === owner) return "Dueño";
  const employee = (account?.empleados || []).find((item) =>
    String(item?.nombre || "").trim().toLocaleLowerCase("es") === eventUser
  );
  return employee?.rol || "Rol sin registrar";
}

export function createAuditEvent({ key, previousValue, nextValue, identity, tenantId, view, deviceId, detail }) {
  const actor = auditActor(identity);
  const metadata = auditChangeMetadata(key, previousValue, nextValue);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    fecha: new Date().toISOString(),
    tenantId: String(tenantId),
    seccion: view || key,
    recurso: key,
    accion: `actualizar_${key}`,
    detalle: detail || describeDataChange(key, previousValue, nextValue),
    dispositivoId: deviceId || null,
    ...metadata,
    ...actor,
  };
}

export function appendCoalescedAudit(events = [], event, windowMs = 20000) {
  const previousEvents = Array.isArray(events) ? events : [];
  if (!event || event.recurso !== "comprasItems" || !event.agrupacion || !previousEvents.length) return [...previousEvents, event].filter(Boolean);
  const previous = previousEvents.at(-1);
  const elapsed = Math.abs(Date.parse(event.fecha || "") - Date.parse(previous?.fecha || ""));
  const sameBurst = previous?.recurso === event.recurso
    && previous?.agrupacion === event.agrupacion
    && previous?.usuarioId === event.usuarioId
    && Number.isFinite(elapsed)
    && elapsed <= windowMs;
  if (!sameBurst) return [...previousEvents, event];

  const merged = {
    ...event,
    id: previous.id,
    primeraFecha: previous.primeraFecha || previous.fecha,
    cantidadAgrupada: Number(previous.cantidadAgrupada || 1) + 1,
  };
  if (previous.cambioCantidad && event.cambioCantidad) {
    merged.cambioCantidad = { ...event.cambioCantidad, desde: previous.cambioCantidad.desde };
    merged.detalle = `Lista de compras: ${event.cambioCantidad.nombre} · cantidad ${merged.cambioCantidad.desde} → ${merged.cambioCantidad.hasta}`;
    if (merged.cambioCantidad.desde === merged.cambioCantidad.hasta) return previousEvents.slice(0, -1);
  }
  return [...previousEvents.slice(0, -1), merged];
}

export function compactAuditEventsForDisplay(events = [], windowMs = 60000) {
  return (Array.isArray(events) ? events : []).reduce((result, event) => {
    const previous = result.at(-1);
    const signature = event?.agrupacion || [event?.recurso, event?.detalle, event?.usuarioId || event?.usuario, event?.seccion].join("|");
    const previousSignature = previous?._displaySignature || previous?.agrupacion || [previous?.recurso, previous?.detalle, previous?.usuarioId || previous?.usuario, previous?.seccion].join("|");
    const elapsed = Math.abs(Date.parse(event?.fecha || "") - Date.parse(previous?.fecha || ""));
    if (previous && signature === previousSignature && Number.isFinite(elapsed) && elapsed <= windowMs) {
      result[result.length - 1] = {
        ...event,
        id: previous.id,
        primeraFecha: previous.primeraFecha || previous.fecha,
        cantidadAgrupada: Number(previous.cantidadAgrupada || 1) + Number(event?.cantidadAgrupada || 1),
        _displaySignature: signature,
      };
      return result;
    }
    result.push({ ...event, _displaySignature: signature });
    return result;
  }, []).map(({ _displaySignature, ...event }) => event);
}

export function hasMeaningfulChange(previousValue, nextValue) {
  return !same(previousValue, nextValue);
}
