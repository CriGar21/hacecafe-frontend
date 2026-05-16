import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const C = {
  bg: "#1a1612",
  bgCard: "#242018",
  bgLight: "#2e2820",
  gold: "#C8913A",
  goldCl: "#E8B96A",
  cream: "#F0E6D3",
  creamDk: "#C4A882",
  text: "#F0E6D3",
  textSub: "#9A8870",
  border: "#3a3228",
  red: "#8B2020",
};

const serif = "'Georgia', 'Times New Roman', serif";

// ── Pasos del seguimiento en orden ──────────────────────────
const PASOS = [
  { estado: "ESPERANDO_APROBACION", label: "Enviado" },
  { estado: "PENDIENTE", label: "Confirmado" },
  { estado: "EN_PREPARACION", label: "Preparando" },
  { estado: "LISTO", label: "¡Listo!" },
];

const ESTADOS_CLIENTE = {
  ESPERANDO_APROBACION: {
    emoji: "⏳",
    titulo: "Esperando confirmación",
    texto: "El local está revisando tu pedido...",
    color: "#C8913A",
    pasoActual: 0,
  },
  PENDIENTE: {
    emoji: "✓",
    titulo: "¡Pedido confirmado!",
    texto: "Tu pedido fue aceptado y pronto empiezan a prepararlo.",
    color: "#4a8a4a",
    pasoActual: 1,
  },
  EN_PREPARACION: {
    emoji: "👨‍🍳",
    titulo: "En preparación",
    texto: "¡Cocina está trabajando en tu pedido!",
    color: "#4A8BCC",
    pasoActual: 2,
  },
  LISTO: {
    emoji: "🔔",
    titulo: "¡Tu pedido está listo!",
    texto: "Pasá a retirar o el mozo te lo lleva en un momento.",
    color: "#4a8a4a",
    pasoActual: 3,
  },
  RECHAZADO: {
    emoji: "✕",
    titulo: "Pedido no procesado",
    texto: "El pedido no pudo procesarse. Hablá con el mozo.",
    color: "#8B2020",
    pasoActual: -1,
  },
  ENTREGADO: {
    emoji: "✓",
    titulo: "¡Pedido entregado!",
    texto: "Que lo disfrutes. ¡Gracias por tu visita!",
    color: "#4a8a4a",
    pasoActual: 4,
  },
};

// Normaliza los estados que pueden llegar del socket
function normalizarEstado(estado) {
  // El backend puede emitir PENDIENTE cuando aprueba (dependiendo del flujo)
  if (estado === "APROBADO") return "PENDIENTE";
  return estado;
}

export default function MenuCliente() {
  const [searchParams] = useSearchParams();
  const mesaDesdeQR = searchParams.get("mesa") || "";

  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [verCarrito, setVerCarrito] = useState(false);
  const [mesa, setMesa] = useState(mesaDesdeQR);
  const [enviando, setEnviando] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(null);
  const [productoDetalle, setProductoDetalle] = useState(null);
  const [notaDetalle, setNotaDetalle] = useState("");

  useEffect(() => {
    fetch(`${API}/categorias`)
      .then((r) => r.json())
      .then((data) => {
        setCategorias(data);
        if (data.length > 0) setCategoriaActiva(data[0].id);
      });
    fetch(`${API}/productos`)
      .then((r) => r.json())
      .then(setProductos);
  }, []);

  const productosFiltrados = productos.filter(
    (p) => p.categoriaId === categoriaActiva,
  );

  const agregarAlCarrito = (producto, nota = "") => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === producto.id);
      if (existe)
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      return [...prev, { ...producto, cantidad: 1, nota }];
    });
  };

  const quitarDelCarrito = (productoId) => {
    setCarrito((prev) => {
      const item = prev.find((i) => i.id === productoId);
      if (item.cantidad === 1) return prev.filter((i) => i.id !== productoId);
      return prev.map((i) =>
        i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i,
      );
    });
  };

  const actualizarNota = (productoId, nota) => {
    setCarrito((prev) =>
      prev.map((i) => (i.id === productoId ? { ...i, nota } : i)),
    );
  };

  const enCarrito = (id) => carrito.find((i) => i.id === id);
  const totalCarrito = carrito.reduce(
    (acc, i) => acc + Number(i.precio) * i.cantidad,
    0,
  );
  const cantidadTotal = carrito.reduce((acc, i) => acc + i.cantidad, 0);

  const abrirDetalle = (producto) => {
    setProductoDetalle(producto);
    setNotaDetalle(enCarrito(producto.id)?.nota || "");
  };

  const confirmarDetalle = () => {
    const item = enCarrito(productoDetalle.id);
    if (!item) {
      agregarAlCarrito(productoDetalle, notaDetalle);
    } else {
      actualizarNota(productoDetalle.id, notaDetalle);
    }
    setProductoDetalle(null);
    setNotaDetalle("");
  };

  const confirmarPedido = async () => {
    if (carrito.length === 0) return;
    setEnviando(true);

    try {
      const r = await fetch(`${API}/pedidos/publico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa,
          items: carrito.map((i) => ({
            productoId: i.id,
            cantidad: i.cantidad,
            notas: i.nota,
          })),
        }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data.error);

      setPedidoEnviado({ ...data, estadoSeguimiento: "ESPERANDO_APROBACION" });
      setCarrito([]);
      setVerCarrito(false);

      const SOCKET_URL =
        import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
      const socket = io(SOCKET_URL, { transports: ["websocket"] });

      socket.on("pedido_aprobado", (pedidoAprobado) => {
        if (pedidoAprobado.id === data.id) {
          setPedidoEnviado((prev) => ({
            ...prev,
            estadoSeguimiento: "PENDIENTE",
          }));
        }
      });

      socket.on("pedido_rechazado", ({ pedidoId }) => {
        if (pedidoId === data.id) {
          setPedidoEnviado((prev) => ({
            ...prev,
            estadoSeguimiento: "RECHAZADO",
          }));
          socket.disconnect();
        }
      });

      socket.on("pedido_actualizado", (pedido) => {
        if (pedido.id === data.id) {
          const estadoNorm = normalizarEstado(pedido.estado);
          setPedidoEnviado((prev) => ({
            ...prev,
            estadoSeguimiento: estadoNorm,
          }));
          // Desconectar solo cuando el pedido ya terminó
          if (["ENTREGADO", "COBRADO", "CANCELADO"].includes(pedido.estado)) {
            socket.disconnect();
          }
        }
      });

      // Timeout de seguridad: 30 minutos
      setTimeout(() => socket.disconnect(), 30 * 60 * 1000);
    } catch (error) {
      alert(error.message || "Error al enviar el pedido");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de seguimiento ──────────────────────────────
  if (pedidoEnviado) {
    const estado = pedidoEnviado.estadoSeguimiento || "ESPERANDO_APROBACION";
    const info =
      ESTADOS_CLIENTE[estado] || ESTADOS_CLIENTE["ESPERANDO_APROBACION"];
    const pasoActual = info.pasoActual;
    const esRechazado = estado === "RECHAZADO";
    const esTerminado = ["ENTREGADO", "COBRADO"].includes(estado);
    const mostrarProgreso = !esRechazado;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#1a1612",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            background: "#242018",
            borderRadius: "20px",
            padding: "2.5rem 2rem",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
            border: "1px solid #3a3228",
          }}
        >
          {/* Ícono de estado */}
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: `${info.color}18`,
              border: `2px solid ${info.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.2rem",
              fontSize: "2rem",
            }}
          >
            {info.emoji}
          </div>

          {/* Número de pedido */}
          <h2
            style={{
              color: "#C8913A",
              fontFamily: "Georgia, serif",
              fontWeight: "700",
              fontSize: "1.4rem",
              margin: "0 0 6px",
            }}
          >
            Pedido #{pedidoEnviado.numero}
          </h2>

          {/* Título y texto del estado */}
          <p
            style={{
              color: info.color,
              margin: "0 0 4px",
              fontSize: "16px",
              fontWeight: "700",
            }}
          >
            {info.titulo}
          </p>
          <p
            style={{
              color: "#9A8870",
              margin: "0 0 1.5rem",
              fontSize: "13px",
            }}
          >
            {info.texto}
          </p>

          {/* Puntos animados solo en ESPERANDO */}
          {estado === "ESPERANDO_APROBACION" && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "6px",
                marginBottom: "1.5rem",
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#C8913A",
                    animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Barra de progreso ── */}
          {mostrarProgreso && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  position: "relative",
                  padding: "0 8px",
                }}
              >
                {/* Línea de fondo — va de centro del 1er círculo al centro del último */}
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    left: "calc(12.5% + 6px)",
                    right: "calc(12.5% + 6px)",
                    height: "2px",
                    background: "#3a3228",
                    zIndex: 0,
                  }}
                />
                {/* Línea de progreso */}
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    left: "calc(12.5% + 6px)",
                    height: "2px",
                    background: "#C8913A",
                    zIndex: 1,
                    width:
                      pasoActual === 0
                        ? "0%"
                        : pasoActual === 1
                          ? "33%"
                          : pasoActual === 2
                            ? "66%"
                            : "75%",
                    transition: "width 0.6s ease",
                  }}
                />
                {/* Pasos */}
                {PASOS.map((paso, idx) => {
                  const completado = idx < pasoActual;
                  const activo = idx === pasoActual;
                  return (
                    <div
                      key={paso.estado}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        zIndex: 2,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: completado
                            ? "#C8913A"
                            : activo
                              ? "#C8913A"
                              : "#2e2820",
                          border: activo
                            ? "2px solid #C8913A"
                            : completado
                              ? "2px solid #C8913A"
                              : "2px solid #3a3228",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "13px",
                          color: completado || activo ? "#1a1612" : "#9A8870",
                          fontWeight: "800",
                          transition: "all 0.4s ease",
                          boxShadow: activo
                            ? "0 0 0 4px rgba(200,145,58,0.2)"
                            : "none",
                        }}
                      >
                        {completado ? "✓" : idx + 1}
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          color: completado || activo ? "#C8913A" : "#9A8870",
                          fontWeight: activo ? "700" : "400",
                          textAlign: "center",
                          lineHeight: 1.2,
                        }}
                      >
                        {paso.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detalle del pedido */}
          <div
            style={{
              border: "1px solid #3a3228",
              borderRadius: "12px",
              padding: "1rem",
              marginBottom: "1.5rem",
              textAlign: "left",
            }}
          >
            {pedidoEnviado.items?.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "14px",
                  padding: "5px 0",
                  borderBottom: "1px solid #3a3228",
                  color: "#F0E6D3",
                }}
              >
                <span>
                  {item.cantidad}x {item.producto?.nombre}
                </span>
                <span style={{ color: "#C8913A", fontWeight: "600" }}>
                  ${Number(item.subtotal).toLocaleString()}
                </span>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "800",
                fontSize: "16px",
                marginTop: "10px",
                color: "#C8913A",
                fontFamily: "Georgia, serif",
              }}
            >
              <span>Total</span>
              <span>${Number(pedidoEnviado.total).toLocaleString()}</span>
            </div>
          </div>

          {/* Botón de acción según estado */}
          {(esRechazado || esTerminado) && (
            <button
              style={{
                background: "#C8913A",
                color: "#1a0e00",
                border: "none",
                borderRadius: "12px",
                padding: "14px",
                width: "100%",
                fontWeight: "800",
                fontSize: "15px",
                cursor: "pointer",
                fontFamily: "Georgia, serif",
              }}
              onClick={() => setPedidoEnviado(null)}
            >
              {esRechazado ? "Volver al menú" : "Hacer otro pedido"}
            </button>
          )}
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        paddingBottom: carrito.length > 0 ? "90px" : "60px",
      }}
    >
      {/* ── HEADER ── */}
      <div
        style={{
          position: "relative",
          background: C.bg,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "220px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(180deg, rgba(26,22,18,0.2) 0%, rgba(26,22,18,0.85) 100%)",
              position: "absolute",
              zIndex: 1,
            }}
          />
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `radial-gradient(ellipse at 60% 40%, #3d2b1a 0%, #1a1410 60%, #0f0c09 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "5rem", opacity: 0.3 }}>☕</span>
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            padding: "0 1.5rem 1.5rem",
            marginTop: "-60px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <h1
            style={{
              fontFamily: serif,
              fontSize: "clamp(2rem, 8vw, 3rem)",
              fontWeight: "700",
              color: C.cream,
              margin: "0 0 6px",
              letterSpacing: "2px",
              textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            }}
          >
            HACECAFE
          </h1>
          <div
            style={{
              width: "60px",
              height: "1px",
              background: C.gold,
              margin: "0 auto 8px",
            }}
          />
          <p
            style={{
              fontFamily: serif,
              color: C.gold,
              fontSize: "13px",
              letterSpacing: "3px",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            Cafetería & Cocina Artesanal
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              marginTop: "12px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                color: C.textSub,
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#4a8a4a",
                  display: "inline-block",
                }}
              />
              Abierto
            </span>
            {mesa && (
              <span
                style={{
                  background: C.gold,
                  color: C.bg,
                  borderRadius: "20px",
                  padding: "3px 14px",
                  fontSize: "12px",
                  fontWeight: "700",
                  letterSpacing: "1px",
                }}
              >
                MESA {mesa}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── INTRO QR ── */}
      {mesaDesdeQR && (
        <div
          style={{
            margin: "1rem 1.5rem",
            background: C.bgCard,
            borderRadius: "10px",
            padding: "12px 16px",
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.gold}`,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: C.textSub,
              lineHeight: 1.6,
            }}
          >
            Explorá el menú, armá tu pedido y envialo desde acá. Un mozo lo
            confirmará en instantes.
          </p>
        </div>
      )}

      {/* ── CATEGORÍAS ── */}
      <div style={{ padding: "1rem 1.5rem 0", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: "8px", minWidth: "max-content" }}>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaActiva(cat.id)}
              style={{
                padding: "9px 20px",
                borderRadius: "30px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
                letterSpacing: "0.3px",
                border:
                  categoriaActiva === cat.id
                    ? `1.5px solid ${C.gold}`
                    : `1.5px solid ${C.border}`,
                background: categoriaActiva === cat.id ? C.gold : "transparent",
                color: categoriaActiva === cat.id ? C.bg : C.textSub,
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {cat.icono} {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* ── SEPARADOR SECCIÓN ── */}
      <div
        style={{
          padding: "1.2rem 1.5rem 0.8rem",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div style={{ height: "1px", flex: 1, background: C.border }} />
        <span
          style={{
            color: C.gold,
            fontSize: "10px",
            fontWeight: "700",
            letterSpacing: "3px",
            textTransform: "uppercase",
            fontFamily: serif,
          }}
        >
          {categorias.find((c) => c.id === categoriaActiva)?.icono}{" "}
          {categorias.find((c) => c.id === categoriaActiva)?.nombre}
        </span>
        <div style={{ height: "1px", flex: 1, background: C.border }} />
      </div>

      {/* ── LISTA DE PRODUCTOS ── */}
      <div
        style={{
          padding: "0 1.5rem",
          display: "flex",
          flexDirection: "column",
          minHeight: "50vh",
        }}
      >
        {productosFiltrados.map((producto, idx) => {
          const item = enCarrito(producto.id);
          return (
            <div key={producto.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 0",
                }}
              >
                <div
                  style={{ flex: 1, cursor: "pointer", minWidth: 0 }}
                  onClick={() => abrirDetalle(producto)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: "600",
                        color: C.text,
                        fontFamily: serif,
                      }}
                    >
                      {producto.nombre}
                    </span>
                    {producto.descripcion && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: C.gold,
                          flexShrink: 0,
                        }}
                      >
                        ver más
                      </span>
                    )}
                  </div>
                  {producto.descripcion && (
                    <p
                      style={{
                        fontSize: "12px",
                        color: C.textSub,
                        margin: "3px 0 0",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {producto.descripcion}
                    </p>
                  )}
                  {item?.nota && (
                    <p
                      style={{
                        fontSize: "11px",
                        color: C.gold,
                        margin: "3px 0 0",
                        fontStyle: "italic",
                      }}
                    >
                      Nota: {item.nota}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    flex: "0 0 40px",
                    borderBottom: `1px dotted ${C.border}`,
                    margin: "0 4px",
                    alignSelf: "center",
                  }}
                />

                <span
                  style={{
                    fontWeight: "700",
                    fontSize: "16px",
                    color: C.gold,
                    fontFamily: serif,
                    flexShrink: 0,
                  }}
                >
                  ${Number(producto.precio).toLocaleString()}
                </span>

                {item ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        background: C.bgLight,
                        border: `1px solid ${C.border}`,
                        color: C.gold,
                        fontSize: "15px",
                        cursor: "pointer",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={() => quitarDelCarrito(producto.id)}
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontWeight: "800",
                        color: C.gold,
                        minWidth: "18px",
                        textAlign: "center",
                        fontSize: "15px",
                      }}
                    >
                      {item.cantidad}
                    </span>
                    <button
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        background: C.gold,
                        border: "none",
                        color: C.bg,
                        fontSize: "15px",
                        cursor: "pointer",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={() => agregarAlCarrito(producto)}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "transparent",
                      border: `1.5px solid ${C.gold}`,
                      color: C.gold,
                      fontSize: "18px",
                      cursor: "pointer",
                      fontWeight: "700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    onClick={() => agregarAlCarrito(producto)}
                  >
                    +
                  </button>
                )}
              </div>

              {idx < productosFiltrados.length - 1 && (
                <div
                  style={{ height: "1px", background: C.border, opacity: 0.5 }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── MODAL DETALLE ── */}
      {productoDetalle && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,8,6,0.85)",
            zIndex: 300,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setProductoDetalle(null)}
        >
          <div
            style={{
              background: C.bgCard,
              borderRadius: "20px 20px 0 0",
              padding: "1.5rem",
              width: "100%",
              border: `1px solid ${C.border}`,
              borderBottom: "none",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "36px",
                height: "3px",
                borderRadius: "2px",
                background: C.border,
                margin: "0 auto 1.2rem",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "14px",
                alignItems: "flex-start",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "10px",
                  flexShrink: 0,
                  backgroundImage: productoDetalle.imagenUrl
                    ? `url(${productoDetalle.imagenUrl})`
                    : "none",
                  backgroundColor: C.bgLight,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                }}
              >
                {!productoDetalle.imagenUrl && productoDetalle.categoria?.icono}
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    color: C.cream,
                    fontFamily: serif,
                    fontWeight: "700",
                    fontSize: "1.2rem",
                    margin: "0 0 4px",
                  }}
                >
                  {productoDetalle.nombre}
                </h3>
                <span
                  style={{
                    color: C.gold,
                    fontWeight: "700",
                    fontSize: "1.1rem",
                    fontFamily: serif,
                  }}
                >
                  ${Number(productoDetalle.precio).toLocaleString()}
                </span>
              </div>
            </div>

            {productoDetalle.descripcion && (
              <p
                style={{
                  color: C.textSub,
                  fontSize: "13px",
                  lineHeight: 1.7,
                  margin: "0 0 1rem",
                  padding: "10px 12px",
                  background: C.bgLight,
                  borderRadius: "8px",
                  border: `1px solid ${C.border}`,
                }}
              >
                {productoDetalle.descripcion}
              </p>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: C.textSub,
                  display: "block",
                  marginBottom: "6px",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                Aclaración especial (opcional)
              </label>
              <input
                type="text"
                value={notaDetalle}
                onChange={(e) => setNotaDetalle(e.target.value)}
                placeholder="Ej: sin azúcar, bien caliente, con leche descremada..."
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: "10px",
                  background: C.bgLight,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {enCarrito(productoDetalle.id) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: C.bgLight,
                    borderRadius: "10px",
                    padding: "8px 14px",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <button
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "transparent",
                      border: `1px solid ${C.border}`,
                      color: C.gold,
                      fontSize: "16px",
                      cursor: "pointer",
                      fontWeight: "700",
                    }}
                    onClick={() => quitarDelCarrito(productoDetalle.id)}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontWeight: "800",
                      color: C.gold,
                      fontSize: "16px",
                      minWidth: "24px",
                      textAlign: "center",
                    }}
                  >
                    {enCarrito(productoDetalle.id)?.cantidad || 0}
                  </span>
                  <button
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: C.gold,
                      border: "none",
                      color: C.bg,
                      fontSize: "16px",
                      cursor: "pointer",
                      fontWeight: "700",
                    }}
                    onClick={() => agregarAlCarrito(productoDetalle)}
                  >
                    +
                  </button>
                </div>
              )}
              <button
                style={{
                  flex: 1,
                  background: C.gold,
                  color: C.bg,
                  border: "none",
                  borderRadius: "10px",
                  padding: "14px",
                  fontWeight: "700",
                  fontSize: "15px",
                  cursor: "pointer",
                  fontFamily: serif,
                  letterSpacing: "0.5px",
                }}
                onClick={confirmarDetalle}
              >
                {enCarrito(productoDetalle.id)
                  ? "Guardar cambios"
                  : "Agregar al pedido"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CARRITO FLOTANTE ── */}
      {carrito.length > 0 && !verCarrito && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: C.gold,
            borderRadius: "50px",
            padding: "14px 22px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            boxShadow: "0 8px 32px rgba(200,145,58,0.35)",
            width: "calc(100% - 3rem)",
            maxWidth: "420px",
            cursor: "pointer",
            zIndex: 100,
          }}
          onClick={() => setVerCarrito(true)}
        >
          <div
            style={{
              background: C.bg,
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "14px",
              color: C.gold,
              flexShrink: 0,
            }}
          >
            {cantidadTotal}
          </div>
          <span
            style={{
              flex: 1,
              fontWeight: "700",
              fontSize: "14px",
              color: C.bg,
              fontFamily: serif,
              letterSpacing: "0.3px",
            }}
          >
            Ver mi pedido
          </span>
          <span
            style={{
              fontWeight: "800",
              fontSize: "16px",
              color: C.bg,
              fontFamily: serif,
            }}
          >
            ${totalCarrito.toLocaleString()}
          </span>
        </div>
      )}

      {/* ── PANEL CARRITO ── */}
      {verCarrito && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,8,6,0.85)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              background: C.bgCard,
              borderRadius: "20px 20px 0 0",
              padding: "1.5rem",
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              border: `1px solid ${C.border}`,
              borderBottom: "none",
            }}
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
                  color: C.cream,
                  fontFamily: serif,
                  fontWeight: "700",
                  fontSize: "1.2rem",
                  margin: 0,
                }}
              >
                Tu pedido
              </h2>
              <button
                style={{
                  background: C.bgLight,
                  border: `1px solid ${C.border}`,
                  borderRadius: "50%",
                  width: "34px",
                  height: "34px",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: C.textSub,
                }}
                onClick={() => setVerCarrito(false)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {carrito.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: C.bgLight,
                    borderRadius: "12px",
                    padding: "12px 14px",
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: "600",
                          fontSize: "14px",
                          color: C.text,
                          fontFamily: serif,
                        }}
                      >
                        {item.nombre}
                      </div>
                      <div style={{ fontSize: "12px", color: C.textSub }}>
                        ${Number(item.precio).toLocaleString()} c/u
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <button
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "50%",
                          background: "transparent",
                          border: `1px solid ${C.border}`,
                          color: C.gold,
                          fontSize: "15px",
                          cursor: "pointer",
                          fontWeight: "700",
                        }}
                        onClick={() => quitarDelCarrito(item.id)}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontWeight: "800",
                          color: C.gold,
                          minWidth: "18px",
                          textAlign: "center",
                        }}
                      >
                        {item.cantidad}
                      </span>
                      <button
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "50%",
                          background: C.gold,
                          border: "none",
                          color: C.bg,
                          fontSize: "15px",
                          cursor: "pointer",
                          fontWeight: "700",
                        }}
                        onClick={() => agregarAlCarrito(item)}
                      >
                        +
                      </button>
                    </div>
                    <span
                      style={{
                        fontWeight: "700",
                        fontSize: "15px",
                        color: C.gold,
                        fontFamily: serif,
                        minWidth: "60px",
                        textAlign: "right",
                      }}
                    >
                      ${(Number(item.precio) * item.cantidad).toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={item.nota || ""}
                    onChange={(e) => actualizarNota(item.id, e.target.value)}
                    placeholder="Aclaración especial..."
                    style={{
                      width: "100%",
                      marginTop: "8px",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      color: C.textSub,
                      fontSize: "12px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              ))}
            </div>

            {!mesaDesdeQR && (
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: C.textSub,
                    display: "block",
                    marginBottom: "6px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                  }}
                >
                  Número de mesa
                </label>
                <input
                  type="text"
                  placeholder="Ej: 5"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: C.bgLight,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    fontSize: "15px",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
            )}

            <div
              style={{
                borderTop: `1px solid ${C.border}`,
                paddingTop: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "14px",
                    color: C.textSub,
                    fontFamily: serif,
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: "800",
                    color: C.gold,
                    fontFamily: serif,
                  }}
                >
                  ${totalCarrito.toLocaleString()}
                </span>
              </div>
              <button
                style={{
                  background: C.gold,
                  color: C.bg,
                  border: "none",
                  borderRadius: "12px",
                  padding: "16px",
                  fontWeight: "800",
                  fontSize: "16px",
                  cursor: "pointer",
                  opacity: enviando ? 0.7 : 1,
                  fontFamily: serif,
                  letterSpacing: "0.5px",
                }}
                onClick={confirmarPedido}
                disabled={enviando}
              >
                {enviando ? "Enviando..." : "Confirmar pedido"}
              </button>
              <p
                style={{
                  textAlign: "center",
                  fontSize: "12px",
                  color: C.textSub,
                  margin: 0,
                }}
              >
                Un mozo confirmará tu pedido en instantes
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
