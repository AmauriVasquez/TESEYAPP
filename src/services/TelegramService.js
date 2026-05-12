/**
 * Servicio de notificaciones de Telegram (Dual: Operaciones + Finanzas)
 * Destinos: 'operaciones' (TELEGRAM_CHAT_ID) | 'finanzas' (TELEGRAM_FINANCE_CHAT_ID)
 */

const CHAT_OPERACIONES = import.meta.env.VITE_TELEGRAM_CHAT_ID;
const CHAT_FINANZAS = import.meta.env.VITE_TELEGRAM_FINANCE_CHAT_ID;
const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;

/**
 * Envía un mensaje a un chat específico
 * @param {string} message - Mensaje a enviar (HTML)
 * @param {'operaciones'|'finanzas'} destino - operaciones = TELEGRAM_CHAT_ID, finanzas = TELEGRAM_FINANCE_CHAT_ID
 * @returns {Promise<boolean>}
 */
export const sendTelegramTo = async (message, destino = 'operaciones') => {
  try {
    const chatId = destino === 'finanzas' ? CHAT_FINANZAS : CHAT_OPERACIONES;
    if (!BOT_TOKEN || !chatId) {
      console.warn(`Telegram: Variables no configuradas para destino "${destino}"`);
      return false;
    }
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('Telegram: Error al enviar', err);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Telegram: Fallo al enviar mensaje', error);
    return false;
  }
};

/**
 * Envía el mismo mensaje a Operaciones y a Finanzas
 */
const sendToBoth = async (message) => {
  await sendTelegramTo(message, 'operaciones');
  await sendTelegramTo(message, 'finanzas');
};

/**
 * Notifica creación de nuevo proyecto (solo Operaciones)
 */
export const notifyNewProject = async (proyecto) => {
  const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const message = `🚀 <b>NUEVO PROYECTO IIHEMSA PENINSULAR</b>\n\n📂 <b>Proyecto:</b> ${proyecto.descripcion || 'Sin nombre'}\n👤 <b>Cliente:</b> ${proyecto.cliente_nombre || 'Sin cliente'}\n📋 <b>Folio:</b> ${proyecto.folio || 'N/A'}\n📅 <b>Fecha:</b> ${fecha}`;
  await sendTelegramTo(message, 'operaciones');
};

/**
 * Bitácora / Avance: SOLO Operaciones
 */
export const notifyBitacoraUpdate = async (data) => {
  const message = `📝 <b>BITÁCORA ACTUALIZADA</b>\n\n📂 <b>Proyecto:</b> ${data.proyectoNombre || 'Sin nombre'}\n${data.folio ? `📋 <b>Folio:</b> ${data.folio}\n` : ''}💬 <b>Nota:</b> ${data.comentario || 'Sin comentario'}`;
  await sendTelegramTo(message, 'operaciones');
};

/**
 * Cotización Aprobada / Nuevo Proyecto Creado: envío dual
 * - Operaciones (TELEGRAM_CHAT_ID): mensaje "NUEVO PROYECTO CREADO"
 * - Finanzas (TELEGRAM_FINANCE_CHAT_ID): mensaje "COTIZACIÓN AUTORIZADA" (venta)
 * @param {Object} params
 * @param {Object} params.projectData - { folio, descripcion, cliente_nombre }
 * @param {Object} params.quoteData - { folio, descripcion } (folio de la cotización)
 */
export const notifyCotizacionAprobada = async ({ projectData, quoteData } = {}) => {
  const proy = projectData || {};
  const quote = quoteData || {};
  const folioProyecto = proy.folio || 'Sin folio';
  const descripcion = proy.descripcion || quote.descripcion || 'Sin descripción';
  const cliente = proy.cliente_nombre || 'Sin cliente';
  const folioCotizacion = quote.folio || proy.cotizacion_folio || 'N/A';

  const messageOperaciones = `🚀 <b>NUEVO PROYECTO CREADO</b>\n───────────────────────────────\n🔢 <b>Proyecto:</b> ${folioProyecto}\n📂 <b>Descripción:</b> ${descripcion}\n👤 <b>Cliente:</b> ${cliente}\n───────────────────────────────\n👉 <i>Ingresa a la App para ver los detalles.</i>`;

  const messageFinanzas = `✅ <b>COTIZACIÓN AUTORIZADA</b>\n───────────────────────────────\n📄 <b>Cotización:</b> ${folioCotizacion}\n📂 <b>Proyecto Relacionado:</b> ${folioProyecto}\n📝 <b>Descripción:</b> ${descripcion}\n👤 <b>Cliente:</b> ${cliente}\n───────────────────────────────\n👉 <i>Ingresa a la App para ver los detalles.</i>`;

  await sendTelegramTo(messageOperaciones, 'operaciones');
  await sendTelegramTo(messageFinanzas, 'finanzas');
};

/**
 * Pago Recibido: SOLO Finanzas. Sin montos (privacidad).
 * Formato: Proyecto, Ref/Folio, estatus validado.
 */
export const notifyPagoRecibido = async (data) => {
  const message = `💰 <b>NUEVO INGRESO REGISTRADO</b>\n───────────────────────────────\n📂 <b>Proyecto:</b> ${data.proyectoNombre || 'Sin nombre'}\n📄 <b>Ref:</b> ${data.referencia || data.folio || 'N/A'}\n✅ <b>Estatus:</b> Pago validado en sistema.\n───────────────────────────────\n<i>Ingresa a la App para ver detalles.</i>`;
  await sendTelegramTo(message, 'finanzas');
};

/**
 * Cambio de estatus (paso intermedio): SOLO Operaciones.
 * @param {Object} data - { folio, descripcion, nuevoEstatus, responsable }
 */
export const notifyStatusChange = async (data = {}) => {
  const folio = data.folio || 'Sin folio';
  const descripcion = data.descripcion || 'Sin descripción';
  const nuevoEstatus = data.nuevoEstatus || 'N/A';
  const responsable = data.responsable || 'Usuario';
  const message = `🔄 <b>CAMBIO DE ESTATUS</b>\n───────────────────────────────\n📂 <b>Proyecto:</b> ${folio}\n⚙️ <b>Nuevo Estatus:</b> ${nuevoEstatus}\n📝 <b>Descripción:</b> ${descripcion}\n👷 <b>Responsable:</b> ${responsable}\n───────────────────────────────\n👉 <i>Ingresa a la App para ver los detalles.</i>`;
  await sendTelegramTo(message, 'operaciones');
};

/** @deprecated Usar notifyStatusChange */
export const notifyPhaseChange = notifyStatusChange;

/**
 * Proyecto Terminado o Entregado: SOLO Operaciones.
 * @param {Object} data - { folio, cliente_nombre, estatus } estatus = 'Terminado' | 'Entregado'
 */
export const notifyProjectFinishedOrDelivered = async (data = {}) => {
  const folio = data.folio || 'Sin folio';
  const cliente = data.cliente_nombre || data.cliente || 'Sin cliente';
  const estatus = (data.estatus === 'Entregado' ? 'ENTREGADO' : 'TERMINADO');
  const message = `🏁 <b>PROYECTO ${estatus}</b>\n───────────────────────────────\n📂 <b>Proyecto:</b> ${folio}\n👤 <b>Cliente:</b> ${cliente}\n🎉 <b>¡Excelente trabajo equipo!</b>\n───────────────────────────────\n👉 <i>Ingresa a la App para ver los detalles.</i>`;
  await sendTelegramTo(message, 'operaciones');
};
