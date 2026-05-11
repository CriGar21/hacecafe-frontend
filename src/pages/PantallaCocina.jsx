import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import api from "../services/api";
import { useTema } from "../context/ThemeContext";
import SelectorTema from "../components/SelectorTema";

const ESTADOS_COCINA = {
  PENDIENTE: {
    border: "#C8913A",
    color: "#F5D78E",
    label: "Pendiente",
    accion: "Iniciar preparación",
    siguiente: "EN_PREPARACION",
  },
  EN_PREPARACION: {
    border: "#4A8BCC",
    color: "#A8CFEE",
    label: "En preparación",
    accion: "Marcar listo",
    siguiente: "LISTO",
  },
  LISTO: {
    border: "#5aaa5a",
    color: "#90e090",
    label: "Listo para entregar",
    accion: "Entregar al mozo",
    siguiente: "ENTREGADO",
  },
  ENTREGADO: {
    border: "#666",
    color: "#aaa",
    label: "Entregado",
    accion: null,
    siguiente: null,
  },
};

// Filtro unificado: mostrar en cocina mientras no esté CANCELADO,
// ENTREGADO ni COBRADO. Si se cobró antes de que cocina termine,
// el pedido se queda hasta que cocina toque "Entregar al mozo".
const filtrarCocina = (p) =>
  ["PENDIENTE", "EN_PREPARACION", "LISTO"].includes(p.estado);

export default function PantallaCocina() {
  const { tema } = useTema();
  const [pedidos, setPedidos] = useState([]);
  const [conectado, setConectado] = useState(false);
  const [pedidoDetalle, setPedidoDetalle] = useState(null);
  const [verStock, setVerStock] = useState(false);
  const [stockProductos, setStockProductos] = useState([]);
  const [cantStock, setCantStock] = useState({});
  const [guardandoStock, setGuardandoStock] = useState({});

  useEffect(() => {
    api.get("/pedidos").then((r) => {
      setPedidos(r.data.filter(filtrarCocina));
    });

    const socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
      { transports: ["websocket"], reconnection: true },
    );

    socket.on("connect", () => setConectado(true));
    socket.on("disconnect", () => setConectado(false));

    socket.on("nuevo_pedido", (p) =>
      setPedidos((prev) =>
        prev.find((x) => x.id === p.id) ? prev : [p, ...prev],
      ),
    );

    socket.on("pedido_aprobado", (p) =>
      setPedidos((prev) =>
        prev.find((x) => x.id === p.id) ? prev : [p, ...prev],
      ),
    );

    socket.on("pedido_actualizado", (act) => {
      setPedidos((prev) =>
        prev.map((p) => (p.id === act.id ? act : p)).filter(filtrarCocina),
      );
      setPedidoDetalle((prev) => (prev?.id === act.id ? act : prev));
    });

    // Al cobrar una mesa: solo sacamos los pedidos que YA terminaron
    // (LISTO o ENTREGADO). Los que están en proceso se quedan.
    socket.on("mesa_cobrada", ({ pedidoIds }) => {
      // Marcar como cobrado en el estado local pero NO sacarlo
      // El filtrarCocina lo mantendrá porque el estado sigue siendo PENDIENTE/EN_PREPARACION/LISTO
      setPedidos((prev) =>
        prev
          .map((p) => (pedidoIds.includes(p.id) ? { ...p, cobrado: true } : p))
          .filter(filtrarCocina),
      );
    });

    const intervalo = setInterval(() => {
      api.get("/pedidos").then((r) => {
        setPedidos(r.data.filter(filtrarCocina));
      });
    }, 30000);

    return () => {
      socket.disconnect();
      clearInterval(intervalo);
    };
  }, []);

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      await api.patch(`/pedidos/${pedidoId}/estado`, { estado: nuevoEstado });
    } catch (e) {
      console.error("Error:", e);
    }
  };

  const cargarStock = () =>
    api.get("/admin/productos").then((r) => setStockProductos(r.data));

  const agregarStock = async (producto) => {
    const cantidad = Number(cantStock[producto.id]);
    if (!cantidad || cantidad <= 0) return;
    setGuardandoStock((prev) => ({ ...prev, [producto.id]: true }));
    try {
      await api.patch(`/admin/productos/${producto.id}/stock`, {
        cantidad,
        operacion: "agregar",
      });
      setCantStock((prev) => ({ ...prev, [producto.id]: "" }));
      cargarStock();
    } catch {
      alert("Error al actualizar stock");
    } finally {
      setGuardandoStock((prev) => ({ ...prev, [producto.id]: false }));
    }
  };

  const getBgCard = (estado) => {
    if (tema.bg === "#F2F2F2") {
      const bgs = {
        PENDIENTE: "#F5EDD8",
        EN_PREPARACION: "#D8E8F5",
        LISTO: "#D8F0DC",
        ENTREGADO: "#EBEBEB",
      };
      return bgs[estado] || tema.bgCard;
    }
    const bgs = {
      PENDIENTE: "#2a1f0e",
      EN_PREPARACION: "#0f1f2a",
      LISTO: "#0f2a15",
      ENTREGADO: "#222",
    };
    return bgs[estado] || tema.bgCard;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: tema.bg,
        padding: "1rem",
        fontFamily: "inherit",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.2rem",
          padding: "8px 4px",
          borderBottom: `1px solid ${tema.borderFaded}`,
        }}
      >
        <div>
          <h1
            style={{
              color: tema.gold,
              fontSize: "1.3rem",
              fontWeight: "800",
              margin: 0,
              fontFamily: "Georgia, serif",
            }}
          >
            Cocina
          </h1>
          <span style={{ fontSize: "12px", color: tema.textSub }}>
            HaceCafe — pedidos activos
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <SelectorTema />
          <button
            style={{
              background: tema.btnActivo,
              border: `1px solid ${tema.borderFaded}`,
              borderRadius: "8px",
              padding: "6px 14px",
              color: tema.text,
              fontSize: "13px",
              cursor: "pointer",
              fontWeight: "600",
            }}
            onClick={() => {
              setVerStock(true);
              cargarStock();
            }}
          >
            Stock
          </button>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "12px",
              color: conectado ? tema.verde : tema.alertaText,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: conectado ? tema.verde : tema.alertaText,
                display: "inline-block",
              }}
            />
            {conectado ? "En vivo" : "Desconectado"}
          </span>
          <span
            style={{
              background: tema.gold,
              color: tema.accentText,
              borderRadius: "20px",
              padding: "4px 14px",
              fontSize: "13px",
              fontWeight: "800",
            }}
          >
            {pedidos.length} en cola
          </span>
        </div>
      </div>

      {/* Grid de pedidos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
          gap: "14px",
        }}
      >
        {pedidos.length === 0 && (
          <div
            style={{
              color: tema.textFaded,
              textAlign: "center",
              padding: "5rem",
              gridColumn: "1/-1",
              fontSize: "15px",
            }}
          >
            Sin pedidos activos
          </div>
        )}
        {pedidos.map((pedido) => {
          const est = ESTADOS_COCINA[pedido.estado] || ESTADOS_COCINA.PENDIENTE;
          return (
            <div
              key={pedido.id}
              style={{
                background: getBgCard(pedido.estado),
                borderRadius: "16px",
                border: `2px solid ${est.border}`,
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: "900",
                    color: tema.text,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  #{pedido.numero}
                </span>
                {pedido.mesa && (
                  <span
                    style={{
                      background: `${est.border}25`,
                      border: `1px solid ${est.border}`,
                      borderRadius: "6px",
                      padding: "3px 10px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: est.color,
                    }}
                  >
                    Mesa {pedido.mesa}
                  </span>
                )}
                {pedido.cobrado && (
                  <span
                    style={{
                      background: "rgba(200,145,58,0.2)",
                      border: "1px solid rgba(200,145,58,0.4)",
                      borderRadius: "6px",
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "#C8913A",
                    }}
                  >
                    COBRADO
                  </span>
                )}
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "11px",
                    fontWeight: "700",
                    color: est.color,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {est.label}
                </span>
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {pedido.items?.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "900",
                        fontSize: "20px",
                        color: est.color,
                        minWidth: "36px",
                        lineHeight: 1,
                      }}
                    >
                      {item.cantidad}x
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: "700",
                          fontSize: "16px",
                          color: tema.text,
                          lineHeight: 1.2,
                        }}
                      >
                        {item.producto?.nombre}
                      </div>
                      {item.notas && (
                        <div
                          style={{
                            marginTop: "4px",
                            background: "rgba(200,145,58,0.15)",
                            border: "1px solid rgba(200,145,58,0.3)",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            fontSize: "12px",
                            color: "#C8913A",
                            fontStyle: "italic",
                          }}
                        >
                          {item.notas}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {pedido.notas && (
                <div
                  style={{
                    background: "rgba(200,145,58,0.1)",
                    border: "1px solid rgba(200,145,58,0.25)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "12px",
                    color: "#C8913A",
                    fontStyle: "italic",
                  }}
                >
                  Nota: {pedido.notas}
                </div>
              )}

              <div style={{ fontSize: "11px", color: tema.textSub }}>
                {new Date(pedido.creadoEn).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  style={{
                    flex: 1,
                    background: `${tema.text}10`,
                    color: tema.textSub,
                    border: `1px solid ${tema.borderFaded}`,
                    borderRadius: "10px",
                    padding: "10px",
                    fontSize: "13px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                  onClick={() => setPedidoDetalle(pedido)}
                >
                  Ver detalle
                </button>
                {est.siguiente && (
                  <button
                    style={{
                      flex: 2,
                      background: est.border,
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      padding: "10px",
                      fontWeight: "800",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                    onClick={() => cambiarEstado(pedido.id, est.siguiente)}
                  >
                    {est.accion}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal detalle */}
      {pedidoDetalle && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setPedidoDetalle(null)}
        >
          <div
            style={{
              background: tema.bgCard,
              border: `2px solid ${tema.gold}`,
              borderRadius: "20px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "440px",
              maxHeight: "88vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1.2rem",
              }}
            >
              <div>
                <h2
                  style={{
                    color: tema.gold,
                    fontFamily: "Georgia, serif",
                    fontSize: "1.4rem",
                    fontWeight: "800",
                    margin: 0,
                  }}
                >
                  Pedido #{pedidoDetalle.numero}
                </h2>
                <span style={{ fontSize: "13px", color: tema.textSub }}>
                  {pedidoDetalle.mesa
                    ? `Mesa ${pedidoDetalle.mesa}`
                    : "Sin mesa"}{" "}
                  ·{" "}
                  {new Date(pedidoDetalle.creadoEn).toLocaleTimeString(
                    "es-AR",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                  {pedidoDetalle.cobrado && (
                    <span
                      style={{
                        marginLeft: "8px",
                        color: "#C8913A",
                        fontWeight: "700",
                      }}
                    >
                      · YA COBRADO
                    </span>
                  )}
                </span>
              </div>
              <button
                style={{
                  background: tema.bgLight,
                  border: `1px solid ${tema.border}`,
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  color: tema.text,
                  fontSize: "16px",
                  cursor: "pointer",
                }}
                onClick={() => setPedidoDetalle(null)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "1rem",
              }}
            >
              {pedidoDetalle.items?.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: tema.bgLight,
                    borderRadius: "12px",
                    padding: "12px 14px",
                    border: `1px solid ${tema.border}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: "900",
                        fontSize: "22px",
                        color: tema.gold,
                        minWidth: "40px",
                        lineHeight: 1,
                      }}
                    >
                      {item.cantidad}x
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: "700",
                          fontSize: "16px",
                          color: tema.text,
                          marginBottom: "2px",
                        }}
                      >
                        {item.producto?.nombre}
                      </div>
                      <div style={{ fontSize: "12px", color: tema.textSub }}>
                        ${Number(item.precioUnit).toLocaleString()} c/u · Total:
                        ${Number(item.subtotal).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {item.notas && (
                    <div
                      style={{
                        marginTop: "10px",
                        background: "rgba(200,145,58,0.12)",
                        border: "1px solid rgba(200,145,58,0.35)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          color: "#C8913A",
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          marginBottom: "3px",
                        }}
                      >
                        Aclaración del cliente
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#C8913A",
                          fontStyle: "italic",
                        }}
                      >
                        {item.notas}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {pedidoDetalle.notas && (
              <div
                style={{
                  background: "rgba(200,145,58,0.08)",
                  border: "1px solid rgba(200,145,58,0.25)",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    color: tema.gold,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  Nota general
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: tema.gold,
                    fontStyle: "italic",
                  }}
                >
                  {pedidoDetalle.notas}
                </div>
              </div>
            )}

            <div
              style={{
                borderTop: `1px solid ${tema.borderFaded}`,
                paddingTop: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <span style={{ color: tema.textSub, fontSize: "14px" }}>
                Total del pedido
              </span>
              <span
                style={{
                  color: tema.gold,
                  fontWeight: "900",
                  fontSize: "1.3rem",
                  fontFamily: "Georgia, serif",
                }}
              >
                ${Number(pedidoDetalle.total).toLocaleString()}
              </span>
            </div>

            {ESTADOS_COCINA[pedidoDetalle.estado]?.siguiente && (
              <button
                style={{
                  width: "100%",
                  background: ESTADOS_COCINA[pedidoDetalle.estado].border,
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  padding: "15px",
                  fontWeight: "800",
                  fontSize: "15px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  cambiarEstado(
                    pedidoDetalle.id,
                    ESTADOS_COCINA[pedidoDetalle.estado].siguiente,
                  );
                  setPedidoDetalle(null);
                }}
              >
                {ESTADOS_COCINA[pedidoDetalle.estado].accion}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal Stock */}
      {verStock && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setVerStock(false)}
        >
          <div
            style={{
              background: tema.bgCard,
              border: `2px solid ${tema.borderFaded}`,
              borderRadius: "20px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "480px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  color: tema.gold,
                  fontFamily: "Georgia, serif",
                  fontSize: "1.2rem",
                  fontWeight: "800",
                  margin: 0,
                }}
              >
                Control de stock
              </h2>
              <button
                style={{
                  background: tema.bgLight,
                  border: `1px solid ${tema.border}`,
                  borderRadius: "50%",
                  width: "34px",
                  height: "34px",
                  color: tema.text,
                  cursor: "pointer",
                  fontSize: "16px",
                }}
                onClick={() => setVerStock(false)}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {stockProductos.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 0",
                    borderBottom: `1px solid ${tema.separador}`,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: "700",
                        fontSize: "14px",
                        color: tema.text,
                      }}
                    >
                      {p.nombre}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color:
                          p.stockActual <= p.stockMinimo
                            ? tema.alertaText
                            : tema.verde,
                        fontWeight: "700",
                      }}
                    >
                      {p.stockActual} unidades{" "}
                      {p.stockActual <= p.stockMinimo ? "— BAJO" : ""}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="1"
                    placeholder="+"
                    value={cantStock[p.id] || ""}
                    onChange={(e) =>
                      setCantStock((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                    style={{
                      width: "70px",
                      padding: "7px",
                      borderRadius: "8px",
                      border: `1px solid ${tema.borderFaded}`,
                      background: tema.inputBg,
                      color: tema.text,
                      fontSize: "14px",
                      textAlign: "center",
                    }}
                  />
                  <button
                    style={{
                      background: tema.accent,
                      color: tema.accentText,
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontWeight: "800",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                    onClick={() => agregarStock(p)}
                    disabled={guardandoStock[p.id]}
                  >
                    {guardandoStock[p.id] ? "..." : "Agregar"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
