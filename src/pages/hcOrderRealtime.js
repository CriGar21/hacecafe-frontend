import { io } from "socket.io-client";

const SOCKET = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const KEY = "hc_cliente_pedido";
const money = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;
const get = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const set = (p) => localStorage.setItem(KEY, JSON.stringify(p));

function paint(p) {
  const root = document.querySelector(".mc-track");
  if (!root) return;
  const rows = root.querySelectorAll(".mc-resumen-row");
  rows.forEach((r) => r.remove());
  const total = root.querySelector(".mc-resumen-total");
  if (total) {
    (p.items || []).forEach((item) => {
      const row = document.createElement("div");
      row.className = "mc-resumen-row";
      row.innerHTML = `<span>${item.cantidad} × ${item.producto?.nombre || "Producto"}</span><span>${money(item.subtotal)}</span>`;
      root.insertBefore(row, total);
    });
    const b = total.querySelector("b");
    if (b) b.textContent = money(p.total);
  }
}

if (location.pathname === "/menu") {
  const inicial = get();
  const socket = io(SOCKET, { transports: ["websocket"], reconnection: true });

  const obtenerNumeroVisible = () => {
    const el = document.querySelector(".mc-track-num");
    const m = el?.textContent?.match(/#(\d+)/);
    return m ? Number(m[1]) : null;
  };

  const coincide = (next) => {
    const guardado = get();
    const id = guardado?.id || inicial?.id;
    const numero = obtenerNumeroVisible();
    return !!next && ((id && next.id === id) || (numero && Number(next.numero) === numero));
  };

  const apply = (next) => {
    if (!coincide(next)) return;
    set(next);
    paint(next);
  };

  socket.on("pedido_actualizado", apply);
  socket.on("pedido_modificado", apply);
  socket.on("pedido_aprobado", apply);
  socket.on("pedido_rechazado", ({ pedidoId }) => {
    const current = get();
    if (pedidoId === current?.id) {
      const next = { ...current, estado: "CANCELADO" };
      set(next);
      paint(next);
    }
  });

  window.addEventListener("beforeunload", () => socket.disconnect());
}
