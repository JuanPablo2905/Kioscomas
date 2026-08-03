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
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    fecha: new Date().toISOString(),
    tenantId: String(tenantId),
    seccion: view || key,
    recurso: key,
    accion: `actualizar_${key}`,
    detalle: detail || describeDataChange(key, previousValue, nextValue),
    dispositivoId: deviceId || null,
    ...actor,
  };
}

export function hasMeaningfulChange(previousValue, nextValue) {
  return !same(previousValue, nextValue);
}
