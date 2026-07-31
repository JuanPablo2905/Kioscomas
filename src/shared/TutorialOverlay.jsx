import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, HelpCircle, MousePointerClick, Play, X } from "lucide-react";

const step = (title, description, target, extra = {}) => ({ title, description, target, ...extra });

const TOURS = {
  home: [{
    id: "overview", title: "Conocer Inicio", description: "El resumen y los accesos principales.",
    steps: [
      step("Este es el panel principal", "Resume caja, ventas, stock y alertas del día. Las tarjetas se actualizan con los movimientos reales.", { selector: '[data-tour="home-summary"]' }),
      step("Entrá a cualquier sección", "El menú lateral en computadora y la barra inferior en celular llevan a todas las áreas. Los números de color indican alertas pendientes.", { selector: '[data-tour="main-navigation"]' }),
      step("Configuración personal", "Desde acá cambiás apariencia, funcionamiento, seguridad, impresora, forma de trabajo y nube.", { selector: '[data-tour="settings-button"]' }),
      step("Escáner global", "Permite escanear desde cualquier sección. Si encuentra un producto ofrece Venta o Stock; si encuentra un ticket abre su información.", { selector: '[data-tour="global-scan"]' }),
      step("Ayuda contextual", "Este botón abre la lista de recorridos de la sección actual. Podés repetirlos cuando quieras.", { selector: '[data-tour="help-button"]' }),
    ],
  }, {
    id: "settings", title: "Configurar la aplicación", description: "Negocio, apariencia, funcionamiento, seguridad y nube.",
    steps: [
      step("Abrí Configuración", "Tocá este botón. El recorrido continuará dentro del menú flotante.", { selector: '[data-tour="settings-button"]' }, { advanceOnClick: true, action: "Tocá Configurar" }),
      step("Negocio", "Cambia el nombre, la imagen y si trabajás solo o con empleados.", { selector: ".settings-panel main" }, { activateSelector: ".settings-panel aside button:nth-of-type(1)" }),
      step("Apariencia", "Personaliza colores, fondo, tarjetas, tema, tipografía y tamaño general.", { selector: ".settings-panel main" }, { activateSelector: ".settings-panel aside button:nth-of-type(2)" }),
      step("Interfaz", "Controla densidad, forma de controles, menú lateral, columnas de Inicio y reinicio de tutoriales.", { selector: ".settings-panel main" }, { activateSelector: ".settings-panel aside button:nth-of-type(3)" }),
      step("Sonido y movimiento", "Ajusta animaciones, confirmaciones, sonidos, volumen y respuesta del escáner.", { selector: ".settings-panel main" }, { activateSelector: ".settings-panel aside button:nth-of-type(4)" }),
      step("Funcionamiento", "Define márgenes, descuentos, stock negativo, vencimientos, categorías, unidades y otras reglas operativas.", { selector: ".settings-panel main" }, { activateSelector: ".settings-panel aside button:nth-of-type(5)" }),
      step("Impresión y cajón", "Configura papel, impresora térmica, impresión automática, cajón registrador y resumen diario.", { selector: ".settings-panel main" }, { activateSelector: ".settings-panel aside button:nth-of-type(6)" }),
      step("Seguridad y tickets", "Controla sesiones, confirmaciones, numeración, redondeo y datos impresos.", { selector: ".settings-panel main" }, { activateSelector: ".settings-panel aside button:nth-of-type(7)" }),
      step("Nube y dispositivos", "Activa sincronización, configura el servidor, la sesión central y el canal de actualizaciones.", { selector: ".settings-panel main" }, { activateSelector: ".settings-panel aside button:nth-of-type(8)" }),
    ],
  }],
  notificaciones: [{
    id: "overview", title: "Revisar notificaciones", description: "Cómo entender y resolver cada alerta.",
    steps: [
      step("Centro de alertas", "Reúne stock bajo, reposición de vitrina, vencimientos y otros asuntos que necesitan atención.", { selector: '[data-tour="notifications-center"]' }),
      step("Prioridad por color", "Rojo requiere atención, amarillo conviene revisarlo y azul es informativo.", { selector: '[data-tour="notifications-filters"]' }),
      step("Resolvé desde el aviso", "Tocá una notificación para ir directamente a la sección y al dato relacionado.", { selector: '[data-tour="notifications-list"]' }),
    ],
  }],
  stock: [
    {
      id: "overview", title: "Recorrer Stock", description: "Productos, importación, precios y submenús.",
      steps: [
        step("Buscá productos", "Podés buscar por nombre, código de barras, familia o variante.", { placeholder: "Buscar por nombre o código" }),
        step("Importar y exportar", "Excel / CSV permite descargar el catálogo o importar muchos productos juntos.", { selector: '[data-tour="stock-transfer"]' }),
        step("Precios masivos", "Actualiza costo o venta de varios productos por porcentaje o importe.", { selector: '[data-tour="stock-prices"]' }),
        step("Escanear", "Busca un producto por lector USB o cámara. Si el código no existe, podés usarlo al crear el producto.", { selector: '[data-tour="stock-scan"]' }),
        step("Grupos", "Crea agrupaciones personalizadas compartidas con Vitrina, por ejemplo Heladera o Mostrador.", { selector: '[data-tour="stock-groups"]' }),
        step("Submenús de Stock", "Productos administra el catálogo; Vencimientos registra pérdidas; Conteo físico compara cantidades; Autoconsumo descuenta sin vender.", { selector: '[data-tour="stock-tabs"]' }),
        step("Vencimientos y pérdidas", "Acá registrás mercadería vencida, rota o faltante y revisás su historial.", { selector: '[data-tour="stock-content-vencimientos"]' }, { activateSelector: '[data-tour="stock-tab-vencimientos"]' }),
        step("Registrar una pérdida", "Tocá Registrar pérdida sobre el producto de práctica. El descarte se hará únicamente en la copia temporal.", { selector: '[data-tour="loss-open"],[data-tour="expiry-summary"]' }, { advanceOnClick: true, action: "Tocá Registrar pérdida" }),
        step("Cantidad y motivo", "Elegí cuánto se descartó y por qué. La aplicación muestra el costo estimado antes de confirmar.", { selector: '[data-tour="loss-form"]' }),
        step("Confirmar el descarte", "Al confirmar se descuenta la mercadería y aparece en el historial ficticio.", { selector: '[data-tour="loss-confirm"]' }, { advanceOnClick: true, action: "Tocá Registrar descarte" }),
        step("Historial de pérdidas", "Cada descarte conserva producto, cantidad, motivo, costo y fecha.", { selector: '[data-tour="loss-history"]' }),
        step("Conteo físico", "Permite contar lo que hay realmente, comparar diferencias y aprobar ajustes de inventario.", { selector: '[data-tour="stock-content-inventario"]' }, { activateSelector: '[data-tour="stock-tab-inventario"]' }),
        step("Iniciar conteo", "Abrí un conteo nuevo para elegir si contarás todo o solamente una categoría.", { selector: '[data-tour="inventory-new"],[data-tour="inventory-history"]' }, { advanceOnClick: true, action: "Tocá Nuevo conteo" }),
        step("Elegir alcance", "Elegí el alcance y tocá Comenzar. El historial previo queda visible cuando no hay un conteo en curso.", { selector: '[data-tour="inventory-start-form"]' }),
        step("Comenzar", "Tocá Comenzar para abrir la planilla de cantidades físicas.", { selector: '[data-tour="inventory-start"]' }, { advanceOnClick: true, action: "Tocá Comenzar" }),
        step("Contar mercadería", "Escribí la cantidad real de al menos un producto. Se calcula automáticamente la diferencia física y a costo.", { selector: '[data-tour="inventory-count"]' }, { action: "Ingresá una cantidad" }),
        step("Aprobar ajustes", "Al aprobar se ajusta la copia temporal del stock y se guarda un conteo con responsable y diferencias.", { selector: '[data-tour="inventory-approve"]' }, { advanceOnClick: true, action: "Tocá Aprobar ajustes" }),
        step("Autoconsumo", "Descuenta productos usados por el negocio sin registrarlos como venta ni pérdida.", { selector: '[data-tour="stock-content-autoconsumo"]' }, { activateSelector: '[data-tour="stock-tab-autoconsumo"]' }),
        step("Registrar autoconsumo", "Elegí producto, cantidad y motivo. Usalo, por ejemplo, para mercadería consumida dentro del local.", { selector: '[data-tour="self-use-form"]' }, { action: "Completá producto y cantidad" }),
        step("Guardar autoconsumo", "Registrar descuenta existencias y deja constancia separada de ventas y pérdidas.", { selector: '[data-tour="self-use-save"]' }),
        step("Historial de autoconsumo", "El historial indica producto, cantidad, responsable y nota. El ejemplo está marcado como ficticio.", { selector: '[data-tour="self-use-history"]' }),
        step("Volver a Productos", "Regresamos al catálogo para ver las acciones disponibles en cada fila.", { selector: '[data-tour="stock-content-stock"]' }, { activateSelector: '[data-tour="stock-tab-stock"]' }),
        step("Acciones del producto", "En cada fila podés copiar, revisar historial, editar o eliminar según tus permisos.", { selector: '[data-tour="stock-product-actions"]' }, { example: { title: "Historial de Producto ejemplo", lines: ["Hoy, 10:15 · Precio actualizado: $900 → $1.100", "Ayer, 18:42 · Stock recibido: +12 unidades"] } }),
      ],
    },
    {
      id: "new-product", title: "Cargar un producto", description: "Recorrido interactivo por el formulario completo.",
      steps: [
        step("Abrí un producto nuevo", "Tocá este botón. El tutorial continuará dentro del formulario.", { selector: '[data-tour="stock-new"]' }, { advanceOnClick: true, action: "Tocá Nuevo" }),
        step("Nombre del producto", "Escribí un nombre claro, incluyendo tamaño o presentación cuando corresponda.", { selector: '[data-tour="product-name"]' }),
        step("Código de barras", "Escribilo o pegalo. También podés llegar al formulario escaneando un código desconocido.", { selector: '[data-tour="product-code"]' }),
        step("Familia y variante", "Familia reúne productos relacionados, como Coca-Cola. Variante identifica 500 ml, Zero o 2,25 L.", { selector: '[data-tour="product-family"]' }),
        step("Forma de venta", "Elegí si se vende por unidad, peso o volumen. Esto cambia cómo se calcula precio y stock.", { selector: '[data-tour="product-unit"]' }),
        step("Pasá a precios y stock", "Tocá Siguiente para continuar. Durante el tutorial podés avanzar aunque todavía no hayas escrito un nombre; fuera del recorrido seguirá siendo obligatorio.", { selector: '[data-tour="product-next"]' }, { advanceOnClick: true, action: "Tocá Siguiente" }),
        step("Costo y venta", "Costo es lo que pagaste; venta es lo que cobrará el negocio. Para peso o volumen se aclara la unidad usada.", { selector: '[data-tour="product-prices"]' }),
        step("Margen sugerido", "Ingresá el porcentaje deseado y Aplicar copiará el precio sugerido al campo de venta.", { selector: '[data-tour="product-margin"]' }),
        step("Depósito y mínimo", "Depósito es la existencia guardada. Mínimo determina cuándo aparece una alerta de stock bajo.", { selector: '[data-tour="product-stock"]' }),
        step("Alerta de vitrina", "Indica a partir de qué cantidad expuesta se debe reponer desde el depósito.", { selector: '[data-tour="product-showcase-alert"]' }),
        step("Categoría, proveedor y vencimiento", "La categoría ordena reportes; el proveedor prepara compras; el vencimiento genera alertas.", { selector: '[data-tour="product-details"]' }),
        step("Guardá el producto", "Revisá los datos y tocá Guardar. El producto aparecerá en la copia de práctica y se descartará al cerrar el tutorial.", { selector: '[data-tour="product-save"]' }, { advanceOnClick: true, action: "Tocá Guardar" }),
      ],
    },
  ],
  vitrina: [{
    id: "overview", title: "Administrar Vitrina", description: "Exhibición, alertas, familias y grupos.",
    steps: [
      step("Buscar en Vitrina", "Filtra por producto, código, variante o grupo.", { placeholder: "Buscar producto, código, variante o grupo" }),
      step("Crear grupos", "Organizá productos por ubicación física, por ejemplo Heladera, Mostrador o Promociones. El editor se abre desde este botón.", { selector: '[data-tour="vitrina-groups"]' }),
      step("Cantidad expuesta", "Cambiá la cantidad de práctica. Al aumentarla, la diferencia se descuenta automáticamente del depósito.", { selector: '[data-tour="vitrina-quantity"]' }, { action: "Modificá la cantidad" }),
      step("Alerta de reposición", "Probá otro umbral. Cuando la vitrina llega a ese valor se genera una alerta para reponer.", { selector: '[data-tour="vitrina-alert"]' }, { action: "Modificá la alerta" }),
      step("Familias y variantes", "Las variantes de un mismo producto aparecen agrupadas. Tocá la familia para desplegarlas.", { selector: '[data-tour="vitrina-family"]' }),
      step("Guardar", "Tocá Guardar. La práctica recalcula depósito y total en la copia temporal; no cambia el stock real.", { selector: '[data-tour="vitrina-save"]' }, { advanceOnClick: true, action: "Tocá Guardar" }),
    ],
  }],
  ventas: [
    {
      id: "sale", title: "Realizar una venta", description: "Desde abrir caja hasta cobrar.",
      steps: [
        step("Submenús de Ventas", "Venta cobra productos; Pedidos reserva mercadería; Presupuestos prepara cotizaciones; Cambio registra vuelto; Turnos organiza personal; Resumen cierra el día.", { selector: '[data-tour="sales-tabs"]' }),
        step("Pedidos de clientes", "Guardá encargos con varios productos, cantidades y estado de preparación.", { selector: '[data-tour="sales-content-pedidos"]' }, { activateSelector: '[data-tour="sales-tab-pedidos"]' }),
        step("Presupuestos", "Prepará una cotización antes de convertirla en una operación real.", { selector: '[data-tour="sales-content-presupuestos"]' }, { activateSelector: '[data-tour="sales-tab-presupuestos"]' }),
        step("Cambio", "Calculá rápidamente el vuelto sin registrar una venta.", { selector: '[data-tour="sales-content-cambio"]' }, { activateSelector: '[data-tour="sales-tab-cambio"]' }),
        step("Turnos", "Cuando hay empleados, organiza quién trabajó y en qué horario.", { selector: '[data-tour="sales-content-turnos"]' }, { activateSelector: '[data-tour="sales-tab-turnos"]' }),
        step("Resumen diario", "Reúne los datos principales del día y permite preparar su impresión.", { selector: '[data-tour="sales-content-resumen"]' }, { activateSelector: '[data-tour="sales-tab-resumen"]' }),
        step("Caja preparada", "Volvemos a Venta. Antes de vender la caja debe estar abierta; en esta demostración ya está preparada.", { selector: '[data-tour="cash-balance"]' }, { activateSelector: '[data-tour="sales-tab-venta"]' }),
        step("Buscar o escanear", "Agregá productos usando el buscador, el escáner o los favoritos. Para este recorrido cargamos un producto ficticio automáticamente.", { placeholder: "Buscar producto" }),
        step("Carrito", "Acá cambiás cantidades, eliminás líneas, aplicás descuentos o suspendés la venta. El producto de demostración desaparecerá al cerrar el tutorial.", { selector: '[data-tour="sales-cart"]' }),
        step("Cobrar", "Tocá este botón para abrir los medios de pago. La demostración no guardará ninguna venta real.", { selector: '[data-tour="sales-charge"]' }, { advanceOnClick: true, action: "Tocá Cobrar para continuar" }),
        step("Medio de pago", "Elegí efectivo, Mercado Pago, tarjeta, transferencia, cuenta corriente o pago combinado.", { selector: '[data-tour="sales-payment"]' }),
        step("Confirmar venta", "En una venta real guarda el ticket, descuenta stock y registra el movimiento correspondiente. Durante el tutorial no modifica datos.", { selector: '[data-tour="sales-confirm"]' }),
      ],
    },
    {
      id: "cash", title: "Manejar la caja", description: "Apertura, movimientos, historial y cierre.",
      steps: [
        step("Saldo de caja", "Representa el efectivo físico calculado por aperturas, ventas en efectivo, ingresos y retiros.", { selector: '[data-tour="cash-balance"]' }),
        step("Agregar o retirar", "Registra cambio para vuelto, retiros personales u otros movimientos manuales con motivo.", { selector: '[data-tour="cash-adjust"]' }),
        step("Movimientos e historial", "Permiten revisar cómo se formó el saldo y consultar cierres anteriores.", { selector: '[data-tour="cash-movements"]' }, { example: { title: "Movimiento de caja ejemplo", lines: ["Hoy, 09:00 · Apertura: $10.000", "Hoy, 12:35 · Venta en efectivo: +$4.500"] } }),
        step("Cerrar caja", "Contá el efectivo real. La aplicación compara lo esperado con lo contado y guarda la diferencia.", { selector: '[data-tour="cash-close"]' }),
      ],
    },
  ],
  compras: [{
    id: "overview", title: "Compras y proveedores", description: "Lista, pedidos, proveedores y recepción.",
    steps: [
      step("Submenús de Compras", "Compras y pedidos arma reposición; Proveedores gestiona contactos y productos; Lista y recordatorios organiza pendientes.", { selector: '[data-tour="purchase-tabs"]' }),
      step("Buscar el producto", "Escribí “Galletitas” en el buscador. Es un producto ficticio creado únicamente para esta práctica.", { selector: '[data-tour="purchase-search"]' }, { action: "Escribí Galletitas" }),
      step("Agregar a la compra", "Tocá el resultado para incorporarlo a la lista. Todavía no se genera ningún pedido real.", { selector: '[data-tour="purchase-search-result"]' }, { advanceOnClick: true, action: "Tocá Agregar" }),
      step("Elegir proveedor", "Seleccioná Distribuidora de práctica. En el uso real aparecen los proveedores que cargaste en el negocio.", { selector: '[data-tour="purchase-supplier"]' }),
      step("Cantidad y costo previstos", "Indicá cuánto pensás comprar y el costo esperado antes de enviar el pedido.", { selector: '[data-tour="purchase-order-values"]' }),
      step("Generar el pedido", "Ahora tocá Generar pedidos. La aplicación lo agrupa con el proveedor seleccionado.", { selector: '[data-tour="purchase-generate"],[data-tour="purchase-tabs"]' }, { advanceOnClick: true, action: "Tocá Generar pedidos" }),
      step("Corregir lo que llegó", "Cuando recibís la mercadería podés cambiar nuevamente tanto la cantidad como el costo para registrar los valores reales.", { selector: '[data-tour="purchase-order-values"],[data-tour="purchase-tabs"]' }),
      step("Confirmar recepción", "Tocá Confirmar recepción. Verás el pedido en Recibidos recientemente, pero esta práctica no aumentará el stock real.", { selector: '[data-tour="purchase-confirm"],[data-tour="purchase-tabs"]' }, { action: "Probá confirmar la recepción" }),
      step("Proveedores", "Creá proveedores, asignales productos y conservá datos de contacto e historial.", { selector: '[data-tour="purchase-content-proveedores"]' }, { activateSelector: '[data-tour="purchase-tab-proveedores"]' }),
      step("Recordatorios", "Programá fecha y hora para pedidos o contactos que no querés olvidar.", { selector: '[data-tour="purchase-content-avisos"]' }, { activateSelector: '[data-tour="purchase-tab-avisos"]' }),
    ],
  }],
  gastos: [{
    id: "overview", title: "Registrar gastos", description: "Gastos pagados, pendientes y recurrentes.",
    steps: [
      step("Nuevo gasto", "Abrí el formulario para cargar concepto, categoría, importe, fecha y medio de pago.", { selector: '[data-tour="expense-new"]' }, { advanceOnClick: true, action: "Tocá Registrar gasto" }),
      step("Completá los datos", "Escribí un gasto de práctica, elegí su categoría, importe, fecha y medio de pago. Todo el recorrido trabaja sobre una copia temporal.", { selector: '[data-tour="expense-dialog"]' }, { action: "Completá el formulario" }),
      step("Estado", "Pagado indica que ya ocurrió; Pendiente permite guardar una obligación futura.", { selector: '[data-tour="expense-status"]' }),
      step("Recurrente", "Sirve para identificar gastos que se repiten. No genera pagos ni copias automáticamente.", { selector: '[data-tour="expense-recurring"]' }),
      step("Impacto", "El gasto reduce la ganancia en Reportes, pero no modifica la caja por sí solo.", { selector: '[data-tour="expense-impact"]' }),
      step("Guardá la práctica", "Tocá Guardar gasto para verlo reflejado. Al terminar el tutorial se descarta y el negocio real queda intacto.", { selector: '[data-tour="expense-save"]' }, { advanceOnClick: true, action: "Tocá Guardar gasto" }),
      step("Resumen e historial", "Las tarjetas separan pagado, pendiente e impacto en ganancia; debajo queda el historial con sus acciones.", { selector: '[data-tour="expense-summary"]' }, { example: { title: "Gasto de ejemplo", lines: ["Alquiler · $250.000", "Vence 10/08 · Pendiente · Recurrente"] } }),
    ],
  }],
  clientes: [{
    id: "overview", title: "Clientes y fiado", description: "Fichas, deudas, pagos y retornables.",
    steps: [
      step("Crear cliente", "Tocá Nuevo cliente. Lo que cargues durante el recorrido se guardará solamente en la copia de práctica.", { selector: '[data-tour="clients-new"]' }, { advanceOnClick: true, action: "Tocá Nuevo cliente" }),
      step("Completá la ficha", "Escribí nombre y, si querés, teléfono. Estos datos sirven para reconocer al cliente al fiar o buscarlo.", { selector: '[data-tour="client-form"]' }),
      step("Guardá el cliente", "Tocá Guardar para crear la ficha ficticia y continuar con sus operaciones.", { selector: '[data-tour="client-save"]' }, { advanceOnClick: true, action: "Tocá Guardar" }),
      step("Cuenta corriente", "Cada tarjeta muestra saldo y acciones. Una deuda aumenta lo pendiente y un pago lo reduce.", { selector: '[data-tour="client-card"],[data-tour="clients-list"]' }),
      step("Cargar una deuda", "Deuda manual permite registrar un fiado que no nació desde una venta. En el uso diario conviene usar ventas con Cuenta corriente.", { selector: '[data-tour="client-debt"],[data-tour="client-card"]' }),
      step("Registrar un pago", "Cuando el cliente paga, elegís importe y medio. Si es efectivo también se registra el ingreso de caja.", { selector: '[data-tour="client-payment"],[data-tour="client-card"]' }),
      step("Vincular e historial", "Podés asociar un ticket suelto y abrir el historial para revisar compras, pagos y correcciones.", { selector: '[data-tour="client-history"],[data-tour="client-link-ticket"],[data-tour="client-card"]' }, { example: { title: "Cuenta de cliente ejemplo", lines: ["María López · Compra fiada: +$8.400", "Pago recibido: -$5.000 · Saldo: $3.400"] } }),
      step("Retornables", "Permite seguir envases u objetos entregados y devueltos por cada cliente.", { selector: '[data-tour="clients-content-retornables"]' }, { activateSelector: '[data-tour="clients-returnables-tab"]' }),
    ],
  }],
  reportes: [{
    id: "overview", title: "Leer Reportes", description: "Períodos, rentabilidad y revisión de tickets.",
    steps: [
      step("Elegí el período", "Filtra hoy, semana, mes u otro rango para no mezclar resultados.", { selector: '[data-tour="reports-period"]' }),
      step("Resumen económico", "Ventas, costos, ganancias y gastos se calculan a partir del historial guardado. Si el período no tiene ventas, este bloque se oculta.", { selector: '[data-tour="reports-summary"],[data-tour="reports-period"]' }),
      step("Rentabilidad por categoría", "Muestra cuánto se vendió y ganó en cada rubro.", { selector: '[data-tour="reports-categories"],[data-tour="reports-period"]' }),
      step("Ranking y productos quietos", "Ayuda a detectar lo más vendido y mercadería sin movimiento.", { selector: '[data-tour="reports-ranking"],[data-tour="reports-period"]' }),
      step("Tickets", "Desplegá una venta para ver sus líneas, reimprimir o anular con motivo.", { selector: '[data-tour="reports-tickets"],[data-tour="reports-period"]' }, { example: { title: "Ticket de ejemplo", lines: ["#1042 · 3 productos · $12.700", "Efectivo · Atendió Juan · 18:42"] } }),
      step("Duplicados", "Sólo alerta cuando coinciden productos, cantidades, importes, pago, cliente y fecha/hora dentro de 24 horas.", { selector: '[data-tour="reports-duplicates"],[data-tour="reports-tickets"],[data-tour="reports-period"]' }),
    ],
  }],
  gestion: [{
    id: "overview", title: "Gestión y herramientas", description: "Tareas, promociones, etiquetas y comprobantes.",
    steps: [
      step("Submenús de herramientas", "Tareas y metas organiza el día; Promociones automatiza descuentos; Etiquetas diseña impresión; Facturación crea comprobantes internos.", { selector: '[data-tour="management-tabs"]' }),
      step("Tareas y metas", "Anotá pendientes y definí un objetivo diario de ventas.", { selector: '[data-tour="management-content-tareas"]' }, { activateSelector: '[data-tour="management-tab-tareas"]' }),
      step("Promociones", "Elegí tipo, productos, fechas y condiciones. La venta aplicará la opción válida más conveniente.", { selector: '[data-tour="management-content-promos"]' }, { activateSelector: '[data-tour="management-tab-promos"]' }),
      step("Etiquetas", "Seleccioná productos y arrastrá nombre, precio y código dentro de la etiqueta.", { selector: '[data-tour="management-content-etiquetas"]' }, { activateSelector: '[data-tour="management-tab-etiquetas"]' }),
      step("Comprobantes", "La sección Facturación genera documentos comerciales internos numerados. No son fiscales y no solicitan CAE a ARCA.", { selector: '[data-tour="management-content-facturacion"]' }, { activateSelector: '[data-tour="management-tab-facturacion"]' }),
      step("Diseño del ticket", "Acá podés personalizar papel, textos, colores, datos visibles y revisar el resultado completo antes de imprimir una venta.", { selector: '[data-tour="ticket-designer-page"]' }, { activateSelectors: ['[data-tour="management-tab-facturacion"]', '[data-tour="invoice-tab-ticket"]'] }),
    ],
  }],
  administracion: [{
    id: "overview", title: "Administrar el negocio", description: "Auditoría, movimientos, empleados y permisos.",
    steps: [
      step("Resumen administrativo", "Muestra la actividad relevante del negocio y posibles movimientos para revisar.", { selector: '[data-tour="administration-content"]' }),
      step("Movimientos de caja", "Permite corregir registros autorizados dejando constancia de quién lo hizo.", { selector: '[data-tour="administration-cash"],[data-tour="administration-content"]' }),
      step("Empleados", "En modo equipo podés crear usuarios independientes para cada persona.", { selector: '[data-tour="administration-employees"],[data-tour="administration-content"]' }),
      step("Roles y permisos", "Decidí qué secciones y acciones puede usar cada rol.", { selector: '[data-tour="administration-roles"],[data-tour="administration-content"]' }),
      step("Auditoría", "Todas las operaciones guardan usuario, rol, fecha, sección y detalle. Las acciones hechas desde tu panel se identifican como Administración de la app.", { selector: '[data-tour="administration-audit"],[data-tour="administration-content"]' }, { example: { title: "Registro de auditoría ejemplo", lines: ["Administrador de la app · Editó precio de Coca-Cola 500 ml", "Hoy, 16:08 · Stock"] } }),
    ],
  }],
};

const normalize = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const visible = (element) => {
  if (!element || !element.isConnected) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
};
const findTarget = (target) => {
  if (!target) return null;
  if (target.selector) {
    for (const selector of target.selector.split(",").map((value) => value.trim()).filter(Boolean)) {
      const found = [...document.querySelectorAll(selector)].find(visible);
      if (found) return found;
    }
    return null;
  }
  if (target.placeholder) return [...document.querySelectorAll("input,textarea")].find((element) => visible(element) && normalize(element.placeholder).includes(normalize(target.placeholder))) || null;
  if (target.text) {
    const wanted = normalize(target.text);
    const candidates = [...document.querySelectorAll('button,label,h1,h2,h3,[role="button"],.section-header-actions,.settings-field')];
    return candidates.find((element) => !element.closest("[data-tutorial-ui]") && visible(element) && normalize(element.textContent).includes(wanted)) || null;
  }
  return null;
};

function TourCatalog({ tours, onSelect, onClose }) {
  return <div data-tutorial-ui className="fixed inset-0 z-[195] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-5"><div className="tutorial-surface max-h-[min(720px,92dvh)] w-full max-w-2xl overflow-y-auto rounded-2xl border shadow-2xl"><div className="tutorial-surface-header sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-accent)]">Centro de ayuda</p><h2 className="tutorial-title text-xl font-bold">¿Qué querés aprender?</h2></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg"><X size={20}/></button></div><div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">{tours.map((tour) => <button key={tour.id} onClick={() => onSelect(tour.id)} className="tutorial-tour-card group rounded-xl border p-4 text-left"><span className="tutorial-tour-icon mb-3 grid h-10 w-10 place-items-center rounded-xl"><Play size={18}/></span><b className="block">{tour.title}</b><span className="mt-1 block text-sm opacity-70">{tour.description}</span><span className="mt-3 flex items-center gap-1 text-xs font-semibold">Empezar · {tour.steps.length} pasos <ChevronRight size={14}/></span></button>)}</div></div></div>;
}

export function TutorialOverlay({ open, view, hasEmployees = true, showCatalog = false, onClose, onComplete }) {
  const tours = useMemo(() => {
    const source = TOURS[view] || TOURS.home;
    if (hasEmployees) return source;
    if (view === "administracion") return source.map((tour) => ({ ...tour, steps: tour.steps.filter((item) => !["Empleados", "Roles y permisos"].includes(item.title)) }));
    if (view === "ventas") return source.map((tour) => ({ ...tour, steps: tour.steps.filter((item) => item.title !== "Turnos") }));
    return source;
  }, [hasEmployees, view]);
  const [tourId, setTourId] = useState(tours[0].id);
  const [catalog, setCatalog] = useState(showCatalog);
  const [index, setIndex] = useState(0);
  const [targetElement, setTargetElement] = useState(null);
  const [rect, setRect] = useState(null);
  const cardRef = useRef(null);
  const [cardSize, setCardSize] = useState({ width: 370, height: 310 });
  const tour = tours.find((item) => item.id === tourId) || tours[0];
  const current = tour.steps[index];

  useEffect(() => {
    setTourId(tours[0].id);
    setIndex(0);
    setCatalog(showCatalog);
  }, [open, showCatalog, tours, view]);
  useEffect(() => {
    if (!open) return undefined;
    document.body.dataset.tutorialActive = "true";
    return () => { delete document.body.dataset.tutorialActive; };
  }, [open]);

  useEffect(() => {
    const selectors = current?.activateSelectors || (current?.activateSelector ? [current.activateSelector] : []);
    if (!open || catalog || selectors.length === 0) return undefined;
    const timers = selectors.map((selector, position) => window.setTimeout(() => {
      const control = document.querySelector(selector);
      if (control && !control.closest("[data-tutorial-ui]")) control.click();
    }, 40 + (position * 140)));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [catalog, current, index, open]);

  useLayoutEffect(() => {
    if (!open || catalog || !current) return undefined;
    let frame;
    let sizeObserver;
    let attempts = 0;
    const locate = () => {
      const found = findTarget(current.target);
      setTargetElement(found);
      if (found) {
        if (attempts === 0) found.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        const next = found.getBoundingClientRect();
        setRect({ top: next.top, left: next.left, right: next.right, bottom: next.bottom, width: next.width, height: next.height });
      } else {
        setRect(null);
      }
      attempts += 1;
      if (attempts < 20) frame = window.setTimeout(locate, 150);
    };
    locate();
    const refresh = () => {
      if (!targetElement || !visible(targetElement)) return;
      const next = targetElement.getBoundingClientRect();
      setRect({ top: next.top, left: next.left, right: next.right, bottom: next.bottom, width: next.width, height: next.height });
    };
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    if (targetElement && typeof ResizeObserver !== "undefined") {
      sizeObserver = new ResizeObserver(refresh);
      sizeObserver.observe(targetElement);
    }
    if (document.fonts?.ready) document.fonts.ready.then(refresh).catch(() => {});
    return () => {
      clearTimeout(frame);
      sizeObserver?.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    };
  }, [catalog, current, index, open, targetElement]);

  useEffect(() => {
    if (!open || catalog || !current?.advanceOnClick || !targetElement) return undefined;
    const nextIndex = Math.min(tour.steps.length - 1, index + 1);
    const advance = () => window.setTimeout(() => setIndex(nextIndex), 180);
    targetElement.addEventListener("click", advance, { once: true });
    return () => targetElement.removeEventListener("click", advance);
  }, [catalog, current, index, open, targetElement, tour.steps.length]);

  useEffect(() => {
    if (!open) return undefined;
    const keyboard = (event) => {
      if (event.key === "Escape") onClose?.();
      if (!catalog && event.key === "ArrowLeft") setIndex((value) => Math.max(0, value - 1));
      if (!catalog && event.key === "ArrowRight" && !current?.advanceOnClick) setIndex((value) => Math.min(tour.steps.length - 1, value + 1));
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [catalog, current?.advanceOnClick, onClose, open, tour.steps.length]);

  useLayoutEffect(() => {
    if (!open || catalog || !cardRef.current) return;
    const measured = cardRef.current.getBoundingClientRect();
    if (measured.width > 0 && measured.height > 0) {
      setCardSize({ width: measured.width, height: measured.height });
    }
  }, [catalog, current, index, open]);

  if (!open) return null;
  if (catalog) return <TourCatalog tours={tours} onClose={onClose} onSelect={(id) => { setTourId(id); setIndex(0); setCatalog(false); }} />;

  const pad = 7;
  const spotlight = rect ? {
    top: Math.max(0, rect.top - pad), left: Math.max(0, rect.left - pad),
    right: Math.min(window.innerWidth, rect.right + pad), bottom: Math.min(window.innerHeight, rect.bottom + pad),
  } : null;
  const visualTop = window.visualViewport?.offsetTop || 0;
  const visualHeight = window.visualViewport?.height || window.innerHeight;
  const visualBottom = visualTop + visualHeight;
  const width = Math.min(370, window.innerWidth - 24);
  const maxCardHeight = Math.max(220, visualHeight - 24);
  const cardHeight = Math.min(cardSize.height || 310, maxCardHeight);
  const viewportPadding = 12;
  const targetGap = 24;
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  let cardTop = visualTop + (visualHeight - cardHeight) / 2;
  let cardLeft = (window.innerWidth - width) / 2;
  if (spotlight) {
    const roomRight = window.innerWidth - spotlight.right - viewportPadding;
    const roomLeft = spotlight.left - viewportPadding;
    const roomBelow = visualBottom - spotlight.bottom - viewportPadding;
    const roomAbove = spotlight.top - visualTop - viewportPadding;
    const centeredTop = clamp(
      spotlight.top + ((spotlight.bottom - spotlight.top) - cardHeight) / 2,
      visualTop + viewportPadding,
      Math.max(visualTop + viewportPadding, visualBottom - cardHeight - viewportPadding),
    );
    const centeredLeft = clamp(
      spotlight.left + ((spotlight.right - spotlight.left) - width) / 2,
      viewportPadding,
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );

    if (roomRight >= width + targetGap) {
      cardLeft = spotlight.right + targetGap;
      cardTop = centeredTop;
    } else if (roomLeft >= width + targetGap) {
      cardLeft = spotlight.left - width - targetGap;
      cardTop = centeredTop;
    } else if (roomBelow >= cardHeight + targetGap) {
      cardTop = spotlight.bottom + targetGap;
      cardLeft = centeredLeft;
    } else if (roomAbove >= cardHeight + targetGap) {
      cardTop = spotlight.top - cardHeight - targetGap;
      cardLeft = centeredLeft;
    } else {
      const largestRoom = Math.max(roomRight, roomLeft, roomBelow, roomAbove);
      if (largestRoom === roomRight) {
        cardLeft = clamp(spotlight.right + targetGap, viewportPadding, window.innerWidth - width - viewportPadding);
        cardTop = centeredTop;
      } else if (largestRoom === roomLeft) {
        cardLeft = clamp(spotlight.left - width - targetGap, viewportPadding, window.innerWidth - width - viewportPadding);
        cardTop = centeredTop;
      } else if (largestRoom === roomBelow) {
        cardTop = clamp(spotlight.bottom + targetGap, visualTop + viewportPadding, visualBottom - cardHeight - viewportPadding);
        cardLeft = centeredLeft;
      } else {
        cardTop = clamp(spotlight.top - cardHeight - targetGap, visualTop + viewportPadding, visualBottom - cardHeight - viewportPadding);
        cardLeft = centeredLeft;
      }
    }
  }
  const last = index === tour.steps.length - 1;
  const finish = () => onComplete?.(view);
  const performHighlightedAction = () => {
    const nextIndex = Math.min(tour.steps.length - 1, index + 1);
    if (targetElement && !targetElement.disabled && targetElement.getAttribute("aria-disabled") !== "true") {
      targetElement.click();
    } else if (targetElement) {
      const floatingMenu = targetElement.closest(".fixed.inset-0");
      const buttons = floatingMenu ? [...floatingMenu.querySelectorAll("button")] : [];
      const closeButton = buttons.find((button) => button.getAttribute("aria-label")?.toLowerCase().includes("cerrar"))
        || buttons.find((button) => normalize(button.textContent).includes("cancelar"));
      closeButton?.click();
    }
    window.setTimeout(() => setIndex(nextIndex), 180);
  };

  return <>
    {spotlight ? <>
      <div data-tutorial-ui className="pointer-events-none fixed left-0 right-0 top-0 z-[190] bg-black/65" style={{ height: spotlight.top }}/>
      <div data-tutorial-ui className="pointer-events-none fixed bottom-0 left-0 right-0 z-[190] bg-black/65" style={{ top: spotlight.bottom }}/>
      <div data-tutorial-ui className="pointer-events-none fixed left-0 z-[190] bg-black/65" style={{ top: spotlight.top, width: spotlight.left, height: spotlight.bottom - spotlight.top }}/>
      <div data-tutorial-ui className="pointer-events-none fixed right-0 z-[190] bg-black/65" style={{ top: spotlight.top, left: spotlight.right, height: spotlight.bottom - spotlight.top }}/>
      <div data-tutorial-ui className="pointer-events-none fixed z-[191] rounded-xl border-[3px] border-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,.25),0_0_26px_rgba(251,191,36,.75)]" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.right - spotlight.left, height: spotlight.bottom - spotlight.top }}/>
      <div
        data-tutorial-ui
        className="pointer-events-none fixed z-[192] grid h-9 w-9 animate-bounce place-items-center rounded-full bg-amber-300 text-amber-950 shadow-lg"
        style={{ top: Math.max(6, spotlight.top - 17), left: Math.max(6, Math.min(window.innerWidth - 42, spotlight.right - 18)) }}
        aria-hidden="true"
      >
        <MousePointerClick size={18}/>
      </div>
    </> : <div data-tutorial-ui className="pointer-events-none fixed inset-0 z-[190] bg-black/65"/>}

    <div ref={cardRef} data-tutorial-ui className="tutorial-surface tutorial-step-card fixed z-[194] overflow-x-hidden overflow-y-auto rounded-2xl border shadow-2xl" style={{ top: cardTop, left: cardLeft, width, maxHeight: maxCardHeight }}>
      <div className="tutorial-surface-header tutorial-step-header flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 gap-2"><span className="tutorial-tour-icon tutorial-step-icon mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"><HelpCircle size={18}/></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-[var(--app-accent)]">{tour.title}</p><p className="tutorial-muted text-xs">Paso {index + 1} de {tour.steps.length}</p></div></div>
        <button onClick={onClose} className="tutorial-step-close grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-gray-100"><X size={18}/></button>
      </div>
      <div className="tutorial-step-body px-4 py-4">
        <div className="tutorial-step-progress mb-3 flex gap-1">{tour.steps.map((_, position) => <span key={position} className={`h-1 flex-1 rounded-full ${position <= index ? "bg-blue-600" : "bg-gray-200"}`}/>)}</div>
        <h3 className="tutorial-title tutorial-step-title text-lg font-bold">{current.title}</h3>
        <p className="tutorial-muted tutorial-step-description mt-2 text-sm leading-5">{current.description}</p>
        {current.example && <div className="tutorial-example mt-3 rounded-xl border p-3"><span className="inline-flex rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-950">Ejemplo ficticio</span><b className="mt-2 block text-sm">{current.example.title}</b><div className="mt-1 space-y-1">{current.example.lines.map((line) => <p key={line} className="text-xs opacity-75">{line}</p>)}</div></div>}
        {current.action && <p className="tutorial-step-action mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800"><MousePointerClick size={15}/>{current.action}</p>}
        {!spotlight && <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">Este control aparece al completar el paso anterior o puede no estar disponible con tus permisos.</p>}
      </div>
      <div className="tutorial-surface-footer tutorial-step-footer flex items-center justify-between gap-2 border-t px-3 py-3">
        <button onClick={() => setCatalog(true)} className="tutorial-step-catalog tutorial-muted min-h-10 px-2 text-xs font-semibold">Recorridos</button>
        <div className="flex gap-2">
          <button onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="tutorial-step-button grid h-10 w-10 place-items-center rounded-lg border bg-white disabled:opacity-30" aria-label="Paso anterior"><ChevronLeft size={17}/></button>
          {last ? <button onClick={finish} className="tutorial-step-button flex min-h-10 items-center gap-1 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white"><CheckCircle2 size={16}/>Terminar</button> : current.advanceOnClick ? <button onClick={performHighlightedAction} className="tutorial-step-button min-h-10 rounded-lg border bg-white px-3 text-xs font-semibold text-gray-600">Hacer y seguir</button> : <button onClick={() => setIndex((value) => value + 1)} className="tutorial-step-button flex min-h-10 items-center gap-1 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">Siguiente<ChevronRight size={16}/></button>}
        </div>
      </div>
    </div>
  </>;
}
