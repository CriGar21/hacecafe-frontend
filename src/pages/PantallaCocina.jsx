import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import api from "../services/api";

const COLORES_ESTADO = {
  PENDIENTE: { bg: "#fff3cd", color: "#856404", label: "Pendiente" },
  EN_PREPARACION: { bg: "#cfe2ff", color: "#0a58ca", label: "En preparación" },
  LISTO: { bg: "#d1e7dd", color: "#0a3622", label: "Listo" },
};

export default function PantallaCocina() {
  const [pedidos, setPedidos] = useState([]);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    // Cargar pedidos activos
    api.get("/pedidos").then((r) => {
      const activos = r.data.filter((p) =>
        ["PENDIENTE", "EN_PREPARACION", "LISTO"].includes(p.estado),
      );
      setPedidos(activos);
    });

    // Crear conexión socket nueva directamente acá
    const socket = io("http://localhost:3001", {
      transports: ["websocket"],
      reconnection: true,
    });

    socket.on("connect", () => {
      console.log("Cocina conectada:", socket.id);
      setConectado(true);
    });

    socket.on("nuevo_pedido", (pedido) => {
      console.log("PEDIDO RECIBIDO:", pedido);
      setPedidos((prev) => [pedido, ...prev]);
    });

    socket.on("pedido_actualizado", (pedidoActualizado) => {
      setPedidos((prev) =>
        prev
          .map((p) => (p.id === pedidoActualizado.id ? pedidoActualizado : p))
          .filter((p) => !["ENTREGADO", "CANCELADO"].includes(p.estado)),
      );
    });

    socket.on("disconnect", () => {
      console.log("Cocina desconectada");
      setConectado(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      await api.patch(`/pedidos/${pedidoId}/estado`, { estado: nuevoEstado });
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  const siguienteEstado = (estado) => {
    const flujo = {
      PENDIENTE: "EN_PREPARACION",
      EN_PREPARACION: "LISTO",
      LISTO: "ENTREGADO",
    };
    return flujo[estado];
  };

  const labelSiguiente = (estado) => {
    const labels = {
      PENDIENTE: "Iniciar",
      EN_PREPARACION: "Marcar listo",
      LISTO: "Entregar",
    };
    return labels[estado];
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.titulo}>Cocina — Pedidos activos</h1>
        <div style={styles.headerRight}>
          <span
            style={{
              ...styles.indicador,
              background: conectado ? "#22c55e" : "#ef4444",
            }}
          />
          <span style={styles.estadoConexion}>
            {conectado ? "En vivo" : "Desconectado"}
          </span>
          <span style={styles.badge}>{pedidos.length} en cola</span>
        </div>
      </div>

      <div style={styles.grid}>
        {pedidos.length === 0 && (
          <div style={styles.vacio}>Sin pedidos activos</div>
        )}
        {pedidos.map((pedido) => {
          const estilo =
            COLORES_ESTADO[pedido.estado] || COLORES_ESTADO.PENDIENTE;
          const siguiente = siguienteEstado(pedido.estado);
          return (
            <div
              key={pedido.id}
              style={{ ...styles.card, background: estilo.bg }}
            >
              <div style={styles.cardHeader}>
                <span style={styles.numero}>#{pedido.numero}</span>
                {pedido.mesa && (
                  <span style={styles.mesa}>Mesa {pedido.mesa}</span>
                )}
                <span style={{ ...styles.estadoBadge, color: estilo.color }}>
                  {estilo.label}
                </span>
              </div>

              <div style={styles.items}>
                {pedido.items.map((item) => (
                  <div key={item.id} style={styles.item}>
                    <span style={styles.itemCantidad}>{item.cantidad}x</span>
                    <span style={styles.itemNombre}>
                      {item.producto.nombre}
                    </span>
                    {item.notas && (
                      <span style={styles.itemNota}>{item.notas}</span>
                    )}
                  </div>
                ))}
              </div>

              {pedido.notas && (
                <p style={styles.notaPedido}>Nota: {pedido.notas}</p>
              )}

              {siguiente && (
                <button
                  style={{ ...styles.btn, background: estilo.color }}
                  onClick={() => cambiarEstado(pedido.id, siguiente)}
                >
                  {labelSiguiente(pedido.estado)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: "100vh", background: "#1a1a1a", padding: "1rem" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1rem",
  },
  titulo: { color: "white", fontSize: "1.3rem", fontWeight: "700", margin: 0 },
  headerRight: { display: "flex", alignItems: "center", gap: "10px" },
  indicador: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    display: "inline-block",
  },
  estadoConexion: { color: "#aaa", fontSize: "13px" },
  badge: {
    background: "#e53e3e",
    color: "white",
    borderRadius: "20px",
    padding: "4px 12px",
    fontSize: "13px",
    fontWeight: "600",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px",
  },
  vacio: {
    color: "#666",
    textAlign: "center",
    padding: "3rem",
    gridColumn: "1/-1",
  },
  card: {
    borderRadius: "14px",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  cardHeader: { display: "flex", alignItems: "center", gap: "8px" },
  numero: { fontSize: "1.4rem", fontWeight: "800", color: "#1a1a1a" },
  mesa: {
    background: "rgba(0,0,0,0.1)",
    borderRadius: "8px",
    padding: "2px 10px",
    fontSize: "13px",
    fontWeight: "600",
  },
  estadoBadge: { marginLeft: "auto", fontSize: "12px", fontWeight: "700" },
  items: { display: "flex", flexDirection: "column", gap: "6px" },
  item: { display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" },
  itemCantidad: { fontWeight: "800", fontSize: "17px", minWidth: "28px" },
  itemNombre: { fontWeight: "500", color: "#1a1a1a" },
  itemNota: { fontSize: "12px", color: "#666", fontStyle: "italic" },
  notaPedido: {
    fontSize: "13px",
    color: "#666",
    background: "rgba(0,0,0,0.05)",
    borderRadius: "8px",
    padding: "8px",
    margin: 0,
  },
  btn: {
    color: "white",
    border: "none",
    borderRadius: "10px",
    padding: "12px",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
    marginTop: "4px",
  },
};
