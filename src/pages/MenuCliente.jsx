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

      // GUARDAR PEDIDO ENVIADO
      setPedidoEnviado({
        ...data,
        estadoSeguimiento: "ESPERANDO",
      });

      // LIMPIAR CARRITO
      setCarrito([]);
      setVerCarrito(false);

      // SOCKET PARA SEGUIMIENTO
      const socket = io("http://localhost:3001", {
        transports: ["websocket"],
      });

      socket.on("pedido_aprobado", (pedidoAprobado) => {
        if (pedidoAprobado.id === data.id) {
          setPedidoEnviado((prev) => ({
            ...prev,
            estadoSeguimiento: "APROBADO",
          }));
        }
      });

      socket.on("pedido_rechazado", ({ pedidoId }) => {
        if (pedidoId === data.id) {
          setPedidoEnviado((prev) => ({
            ...prev,
            estadoSeguimiento: "RECHAZADO",
          }));
        }
      });

      socket.on("pedido_actualizado", (pedido) => {
        if (pedido.id === data.id) {
          setPedidoEnviado((prev) => ({
            ...prev,
            estadoSeguimiento: pedido.estado,
          }));
        }
      });
    } catch (error) {
      alert(error.message || "Error al enviar el pedido");
    } finally {
      setEnviando(false);
    }
  };

  // ── Confirmado ──────────────────────────────────────────────
  if (pedidoEnviado) {
    const estado = pedidoEnviado.estadoSeguimiento || "ESPERANDO";

    const ESTADOS_CLIENTE = {
      ESPERANDO: {
        emoji: "⏳",
        texto: "Esperando confirmación del local...",
        color: "#C8913A",
      },
      APROBADO: {
        emoji: "✓",
        texto: "¡Pedido confirmado! Lo están preparando.",
        color: "#4a8a4a",
      },
      RECHAZADO: {
        emoji: "✕",
        texto: "El pedido no pudo procesarse. Hablá con el mozo.",
        color: "#8B2020",
      },
    };

    const info = ESTADOS_CLIENTE[estado];

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
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(200,145,58,0.15)",
              border: `2px solid ${info.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              fontSize: "2rem",
              color: info.color,
            }}
          >
            {info.emoji}
          </div>
          <h2
            style={{
              color: "#C8913A",
              fontFamily: "Georgia, serif",
              fontWeight: "700",
              fontSize: "1.4rem",
              margin: "0 0 8px",
            }}
          >
            Pedido #{pedidoEnviado.numero}
          </h2>
          <p
            style={{
              color: info.color,
              margin: "0 0 1.5rem",
              fontSize: "15px",
              fontWeight: "600",
            }}
          >
            {info.texto}
          </p>

          {estado === "ESPERANDO" && (
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

          {(estado === "RECHAZADO" || estado === "APROBADO") && (
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
              {estado === "RECHAZADO" ? "Volver al menú" : "Hacer otro pedido"}
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
        {/* Imagen portada */}
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

        {/* Nombre del local */}
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

          {/* Info mesa y estado */}
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

      {/* ── LISTA DE PRODUCTOS — estilo carta ── */}
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
                {/* Nombre y descripción */}
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

                {/* Puntos decorativos */}
                <div
                  style={{
                    flex: "0 0 40px",
                    borderBottom: `1px dotted ${C.border}`,
                    margin: "0 4px",
                    alignSelf: "center",
                  }}
                />

                {/* Precio */}
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

                {/* Controles */}
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

              {/* Separador */}
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
            {/* Handle */}
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
              {/* Imagen pequeña */}
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "10px",
                  flexShrink: 0,
                  background: (producto) =>
                    producto?.imagenUrl
                      ? `url(${productoDetalle.imagenUrl}) center/cover`
                      : C.bgLight,
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2rem",
                }}
              >
                {productoDetalle.categoria?.icono}
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

            {/* Nota especial */}
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

            {/* Controles cantidad + confirmar */}
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
                  {/* Nota editable en carrito */}
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

            {/* Mesa si no viene del QR */}
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
