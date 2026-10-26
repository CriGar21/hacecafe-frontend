import { io } from "socket.io-client";

// El menú importa este archivo desde src/main.jsx, por eso esta es la integración
// real que debe escuchar los cambios del pedido del cliente.
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SOCKET = import.meta.env.VITE_SOCKET_URL || API;
const KEY = "hc_cliente_pedido";

const money = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
const get = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};
const set = (p) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
};

let ultimoPedido = get();
let pendiente = null;

function numeroVisible() {
  const el = document.querySelector(".mc-track-num");
  const m = el?.textContent?.match(/#(\d+)/);
  return m ? Number(m[1]) : null;
}

function esMismoPedido(p) {
  if (!p) return false;
  const guardado = get() || ultimoPedido;
  const id = guardado?.id;
  const numero = numeroVisible();

  // Primero por ID si lo tenemos; si no, por número visible del ticket.
  if (id != null && p.id != null) return String(p.id) === String(id);
  if (numero != null && p.numero != null) return Number(p.numero) === numero;
  return false;
}

function paint(p) {
  const root = document.querySelector(".mc-track");
  if (!root || !p) {
    pendiente = p;
    return false;
  }

  const total = root.querySelector(".mc-resumen-total");
  if (!total) {
    pendiente = p;
    return false;
  }

  root.querySelectorAll(".mc-resumen-row").forEach((r) => r.remove());

  (p.items || []).forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "mc-resumen-row";
    row.dataset.realtime = "true";

    const nombre = item.producto?.nombre || item.nombre || "Producto";
    const cantidad = Number(item.cantidad || 0);
    const subtotal = item.subtotal != null
      ? item.subtotal
      : Number(item.precio || item.producto?.precio || 0) * cantidad;

    const left = document.createElement("span");
    left.textContent = `${cantidad} × ${nombre}`;
    const right = document.createElement("span");
    right.textContent = money(subtotal);
    row.append(left, right);

    root.insertBefore(row, total);
  });

  const totalNode = total.querySelector("b");
  if (totalNode) totalNode.textContent = money(p.total);

  // Si el pedido cambió de estado también reflejamos el estado visual básico.
  if (p.estado === "CANCELADO") {
    const h = root.querySelector("h1");
    if (h) h.textContent = "Pedido cancelado";
  }

  pendiente = null;
  ultimoPedido = p;
  set(p);
  return true;
}

if (location.pathname === "/menu") {
  // Conectamos aunque todavía no exista pedido guardado. El pedido puede haberse
  // creado en esta misma pantalla y React todavía no lo habrá persistido.
  const socket = io(SOCKET, {
    transports: ["websocket"],
    reconnection: true,
  });

  const aplicar = (next) => {
    if (!next || !esMismoPedido(next)) return;
    ultimoPedido = next;
    set(next);
    paint(next);
  };

  socket.on("pedido_modificado", aplicar);
  socket.on("pedido_actualizado", aplicar);
  socket.on("pedido_aprobado", aplicar);

  socket.on("pedido_rechazado", ({ pedidoId }) => {
    const actual = get() || ultimoPedido;
    if (!actual || String(pedidoId) !== String(actual.id)) return;
    const next = { ...actual, estado: "CANCELADO" };
    ultimoPedido = next;
    set(next);
    paint(next);
  });

  // React monta .mc-track después de recibir/renderizar el pedido. Si el evento
  // llega antes, el MutationObserver aplica la actualización en cuanto aparece.
  const observer = new MutationObserver(() => {
    if (pendiente) paint(pendiente);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Si había un pedido guardado y la pantalla ya está montada, sincronizamos.
  if (ultimoPedido) paint(ultimoPedido);

  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    socket.disconnect();
  });
}
