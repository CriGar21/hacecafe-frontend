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
      const row = document.createElement("div"); row.className = "mc-resumen-row";
      row.innerHTML = `<span>${item.cantidad} × ${item.producto?.nombre || "Producto"}</span><span>${money(item.subtotal)}</span>`;
      root.insertBefore(row, total);
    });
    const b = total.querySelector("b"); if (b) b.textContent = money(p.total);
  }
  if (p.estado === "CANCELADO") {
    const h = root.querySelector("h1"); if (h) h.textContent = "Pedido cancelado";
    root.querySelector(".hc-flow-actions")?.remove();
  }
}

if (location.pathname === "/menu") {
  const p = get();
  if (p?.id) {
    const socket = io(SOCKET, { transports: ["websocket"], reconnection: true });
    const apply = (next) => { if (!next || next.id !== p.id) return; set(next); paint(next); if (["CANCELADO", "COBRADO"].includes(next.estado)) socket.disconnect(); };
    socket.on("pedido_actualizado", apply);
    socket.on("pedido_modificado", apply);
    socket.on("pedido_rechazado", ({ pedidoId }) => { if (pedidoId === p.id) { const next = { ...get(), estado: "CANCELADO" }; set(next); paint(next); socket.disconnect(); } });
    window.addEventListener("beforeunload", () => socket.disconnect());
  }
}
