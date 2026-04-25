import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useTema } from "../context/ThemeContext";
import api from "../services/api";
import Ticket from "../components/Ticket";
import PantallaPago from "../components/PantallaPago";
import SelectorTema from "../components/SelectorTema";

const TABS = ["Cargar pedido", "Solicitudes", "Mis pedidos", "Cobrar"];

const COLORES_ESTADO = {
  ESPERANDO_APROBACION: { label: "Esperando aprobación" },
  PENDIENTE: { label: "Pendiente" },
  EN_PREPARACION: { label: "En preparación" },
  LISTO: { label: "Listo" },
  ENTREGADO: { label: "Entregado" },
  COBRADO: { label: "Cobrado" },
  CANCELADO: { label: "Cancelado" },
};

const COLOR_ESTADO_TEXT = {
  ESPERANDO_APROBACION: "#C8913A",
  PENDIENTE: "#F5D78E",
  EN_PREPARACION: "#85B7EB",
  LISTO: "#7ec87e",
  ENTREGADO: "#888",
  COBRADO: "#90e090",
  CANCELADO: "#e07070",
};

export default function PantallaEmpleado() {
  const { usuario, logout } = useAuth();
  const { tema } = useTema();
  const st = getStyles(tema);

  const [tab, setTab] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [mesa, setMesa] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [misPedidos, setMisPedidos] = useState([]);

  const [busquedaCobro, setBusquedaCobro] = useState("");
  const [tipoBusqueda, setTipoBusqueda] = useState("mesa");
  const [pedidosCobro, setPedidosCobro] = useState([]);
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [cobrando, setCobrando] = useState(false);
  const [cobrado, setCobrado] = useState(null);

  const [pantallaPago, setPantallaPago] = useState(null);
  const [ticketCobro, setTicketCobro] = useState(null);

  const razonSocial = {
    nombre: localStorage.getItem("rs_nombre") || "HaceCafe",
    subtitulo:
      localStorage.getItem("rs_subtitulo") || "Cafetería & Cocina Artesanal",
    direccion: localStorage.getItem("rs_direccion") || "",
    telefono: localStorage.getItem("rs_telefono") || "",
    cuit: localStorage.getItem("rs_cuit") || "",
  };

  const cargarPedidos = useCallback(() => {
    api.get("/pedidos").then((r) => {
      setMisPedidos(
        r.data.filter(
          (p) => !["COBRADO", "CANCELADO"].includes(p.estado) && !p.cobrado,
        ),
      );
    });
  }, []);

  useEffect(() => {
    api
      .get("/pedidos")
      .then((r) =>
        setSolicitudes(
          r.data.filter((p) => p.estado === "ESPERANDO_APROBACION"),
        ),
      );
    api.get("/categorias").then((r) => {
      setCategorias(r.data);
      if (r.data.length > 0) setCategoriaActiva(r.data[0].id);
    });
    api.get("/productos").then((r) => setProductos(r.data));
    cargarPedidos();

    const socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
      { transports: ["websocket"], reconnection: true },
    );

    socket.on("solicitud_cliente", (p) =>
      setSolicitudes((prev) => [p, ...prev]),
    );
    socket.on("pedido_aprobado", (p) =>
      setSolicitudes((prev) => prev.filter((x) => x.id !== p.id)),
    );
    socket.on("pedido_rechazado", ({ pedidoId }) =>
      setSolicitudes((prev) => prev.filter((x) => x.id !== pedidoId)),
    );
    socket.on("nuevo_pedido", (p) =>
      setMisPedidos((prev) =>
        prev.find((x) => x.id === p.id) ? prev : [p, ...prev],
      ),
    );
    socket.on("pedido_actualizado", (act) =>
      setMisPedidos((prev) => prev.map((p) => (p.id === act.id ? act : p))),
    );
    socket.on("mesa_cobrada", ({ pedidoIds }) =>
      setMisPedidos((prev) => prev.filter((p) => !pedidoIds.includes(p.id))),
    );

    return () => socket.disconnect();
  }, [cargarPedidos]);

  const productosFiltrados = productos.filter((p) =>
    busqueda
      ? p.nombre.toLowerCase().includes(busqueda.toLowerCase())
      : p.categoriaId === categoriaActiva,
  );

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === producto.id);
      if (existe)
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      return [...prev, { ...producto, cantidad: 1 }];
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

  const totalCarrito = carrito.reduce(
    (acc, i) => acc + Number(i.precio) * i.cantidad,
    0,
  );

  const confirmarPedido = async () => {
    if (carrito.length === 0) return;
    setEnviando(true);
    try {
      const { data } = await api.post("/pedidos", {
        mesa,
        notas,
        items: carrito.map((i) => ({ productoId: i.id, cantidad: i.cantidad })),
      });
      setConfirmado(data);
      setCarrito([]);
      setMesa("");
      setNotas("");
    } catch (error) {
      const mensaje = error.response?.data?.error || "Error al enviar pedido";
      alert(mensaje);
      if (mensaje.includes("Stock insuficiente")) {
        const nombreProducto = mensaje.replace("Stock insuficiente de ", "");
        setProductos((prev) =>
          prev.map((p) =>
            p.nombre === nombreProducto ? { ...p, sinStock: true } : p,
          ),
        );
      }
    } finally {
      setEnviando(false);
    }
  };

  const irACobrarPedido = (pedido) => {
    setTipoBusqueda("numero");
    setBusquedaCobro(String(pedido.numero));
    setPedidosCobro([pedido]);
    setCobrado(null);
    setTab(3);
  };

  const buscarParaCobrar = async () => {
    if (!busquedaCobro.trim()) return;
    try {
      const url =
        tipoBusqueda === "mesa"
          ? `/pedidos/mesa/${busquedaCobro}`
          : `/pedidos/numero/${busquedaCobro}`;
      const { data } = await api.get(url);
      setPedidosCobro(Array.isArray(data) ? data : [data]);
      setCobrado(null);
    } catch {
      alert("No se encontraron pedidos");
      setPedidosCobro([]);
    }
  };

  const totalCobro = pedidosCobro.reduce((acc, p) => acc + Number(p.total), 0);

  const abrirPantallaPago = () => {
    if (!pedidosCobro || pedidosCobro.length === 0) return;
    const pedido = pedidosCobro[0];
    setPantallaPago({
      numero: pedido?.numero || "",
      numeroPedido: busquedaCobro,
      mesa: pedido?.mesa || "",
      total: totalCobro || 0,
      items: pedidosCobro.flatMap((p) => p.items || []),
    });
  };

  const confirmarPagoReal = async () => {
    setCobrando(true);
    try {
      const body =
        tipoBusqueda === "mesa"
          ? { mesa: busquedaCobro, metodoPago }
          : { numeroPedido: busquedaCobro, metodoPago };
      const { data } = await api.post("/pedidos/cobrar", body);
      const ticketData = {
        numero: data.pedidos?.[0]?.numero || busquedaCobro,
        mesa: data.mesa,
        creadoEn: new Date().toISOString(),
        total: data.totalCobrado,
        metodoPago,
        items: data.pedidos?.flatMap((p) => p.items || []) || [],
      };
      setCobrado(data);
      setPantallaPago(null);
      setPedidosCobro([]);
      setBusquedaCobro("");
      setTicketCobro(ticketData);
    } catch {
      alert("Error al cobrar");
    } finally {
      setCobrando(false);
    }
  };

  const totalActivos = misPedidos.length;

  return (
    <div style={st.container}>
      {/* Header */}
      <div style={st.header}>
        <div>
          <div style={st.headerNombre}>HaceCafe</div>
          <div style={st.headerUsuario}>
            {usuario?.nombre} — {usuario?.rol}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <SelectorTema />
          {usuario?.rol === "DUEÑO" && (
            <a
              href="/admin"
              style={{ ...st.btnLogout, textDecoration: "none" }}
            >
              Panel admin
            </a>
          )}
          <button style={st.btnLogout} onClick={logout}>
            Salir
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={st.tabs}>
        {TABS.map((t, i) => (
          <button
            key={i}
            style={{ ...st.tab, ...(tab === i ? st.tabActivo : {}) }}
            onClick={() => {
              setTab(i);
              setConfirmado(null);
              setCobrado(null);
            }}
          >
            {t}
            {i === 1 && solicitudes.length > 0 && (
              <span style={st.tabBadge}>{solicitudes.length}</span>
            )}
            {i === 2 && totalActivos > 0 && (
              <span style={st.tabBadge}>{totalActivos}</span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 0 — Cargar pedido */}
      {tab === 0 && (
        <div style={st.content}>
          {confirmado ? (
            <div style={st.confirmadoBox}>
              <div style={st.checkIcon}>✓</div>
              <h2 style={st.confirmadoTitulo}>
                Pedido #{confirmado.numero} enviado
              </h2>
              {confirmado.mesa && (
                <p style={st.confirmadoSub}>Mesa {confirmado.mesa}</p>
              )}
              <div style={st.confirmadoItems}>
                {confirmado.items.map((item) => (
                  <div key={item.id} style={st.confirmadoItem}>
                    <span>
                      {item.cantidad}x {item.producto.nombre}
                    </span>
                    <span>${Number(item.subtotal).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={st.confirmadoTotal}>
                <span>Total</span>
                <span>${Number(confirmado.total).toLocaleString()}</span>
              </div>
              <div style={st.confirmadoBtns}>
                <button
                  style={st.btnPrimario}
                  onClick={() => setConfirmado(null)}
                >
                  Nuevo pedido
                </button>
                <button
                  style={st.btnSecundario}
                  onClick={() => irACobrarPedido(confirmado)}
                >
                  Cobrar este pedido
                </button>
              </div>
            </div>
          ) : (
            <div style={st.layoutDos}>
              <div style={st.panelMenu}>
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setCategoriaActiva(null);
                  }}
                  style={st.buscador}
                />
                {!busqueda && (
                  <div style={st.categorias}>
                    {categorias.map((cat) => (
                      <button
                        key={cat.id}
                        style={{
                          ...st.catBtn,
                          ...(categoriaActiva === cat.id
                            ? st.catBtnActivo
                            : {}),
                        }}
                        onClick={() => setCategoriaActiva(cat.id)}
                      >
                        {cat.icono} {cat.nombre}
                      </button>
                    ))}
                  </div>
                )}
                <div style={st.listaProductos}>
                  {productosFiltrados.map((producto) => {
                    const enCarrito = carrito.find((i) => i.id === producto.id);
                    return (
                      <div
                        key={producto.id}
                        style={{
                          ...st.productoRow,
                          opacity: producto.sinStock ? 0.5 : 1,
                          border: producto.sinStock
                            ? `1px solid ${tema.alertaBorder}`
                            : `1px solid ${tema.borderFaded}`,
                        }}
                      >
                        <div style={st.productoInfo}>
                          <span style={st.productoNombre}>
                            {producto.nombre}
                          </span>
                          <span style={st.productoPrecio}>
                            ${Number(producto.precio).toLocaleString()}
                            {producto.sinStock && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  fontSize: "11px",
                                  color: tema.alertaText,
                                }}
                              >
                                SIN STOCK
                              </span>
                            )}
                          </span>
                        </div>
                        <div style={st.contador}>
                          {enCarrito && (
                            <button
                              style={st.btnContador}
                              onClick={() => quitarDelCarrito(producto.id)}
                            >
                              −
                            </button>
                          )}
                          {enCarrito && (
                            <span style={st.cantidadContador}>
                              {enCarrito.cantidad}
                            </span>
                          )}
                          <button
                            style={st.btnContadorPrimario}
                            onClick={() => agregarAlCarrito(producto)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={st.panelCarrito}>
                <h3 style={st.carritoTitulo}>Pedido actual</h3>
                <input
                  type="text"
                  placeholder="Mesa (opcional)"
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  style={st.inputMesa}
                />
                {carrito.length === 0 ? (
                  <p style={st.carritoVacio}>Agregá productos desde el menú</p>
                ) : (
                  <>
                    <div style={st.carritoItems}>
                      {carrito.map((item) => (
                        <div key={item.id} style={st.carritoItem}>
                          <div style={st.carritoItemInfo}>
                            <span style={st.carritoItemNombre}>
                              {item.nombre}
                            </span>
                            <span style={st.carritoItemSub}>
                              ${Number(item.precio).toLocaleString()} c/u
                            </span>
                          </div>
                          <div style={st.contador}>
                            <button
                              style={st.btnContador}
                              onClick={() => quitarDelCarrito(item.id)}
                            >
                              −
                            </button>
                            <span style={st.cantidadContador}>
                              {item.cantidad}
                            </span>
                            <button
                              style={st.btnContadorPrimario}
                              onClick={() => agregarAlCarrito(item)}
                            >
                              +
                            </button>
                          </div>
                          <span style={st.carritoItemTotal}>
                            $
                            {(
                              Number(item.precio) * item.cantidad
                            ).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <textarea
                      placeholder="Notas del pedido (opcional)"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      style={st.notasInput}
                      rows={2}
                    />
                    <div style={st.carritoFooter}>
                      <div style={st.carritoTotal}>
                        <span>Total</span>
                        <span style={st.carritoTotalNum}>
                          ${totalCarrito.toLocaleString()}
                        </span>
                      </div>
                      <button
                        style={{
                          ...st.btnPrimario,
                          opacity: enviando ? 0.7 : 1,
                        }}
                        onClick={confirmarPedido}
                        disabled={enviando}
                      >
                        {enviando ? "Enviando..." : "Enviar a cocina"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1 — Solicitudes */}
      {tab === 1 && (
        <div style={st.content}>
          {solicitudes.length === 0 ? (
            <div style={st.vacio}>Sin solicitudes pendientes</div>
          ) : (
            <div style={st.gridPedidos}>
              {solicitudes.map((pedido) => (
                <div
                  key={pedido.id}
                  style={{ ...st.pedidoCard, border: `2px solid ${tema.gold}` }}
                >
                  <div style={st.pedidoHeader}>
                    <span style={st.pedidoNumero}>#{pedido.numero}</span>
                    {pedido.mesa && (
                      <span style={st.pedidoMesa}>Mesa {pedido.mesa}</span>
                    )}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "11px",
                        fontWeight: "700",
                        color: tema.gold,
                      }}
                    >
                      Solicitud cliente
                    </span>
                  </div>
                  <div style={st.pedidoItems}>
                    {pedido.items?.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                        }}
                      >
                        <div style={st.pedidoItem}>
                          <span style={{ fontWeight: "700" }}>
                            {item.cantidad}x {item.producto?.nombre}
                          </span>
                          <span style={{ color: tema.gold }}>
                            ${Number(item.subtotal).toLocaleString()}
                          </span>
                        </div>
                        {item.notas && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#C8913A",
                              fontStyle: "italic",
                              background: "rgba(200,145,58,0.1)",
                              borderRadius: "4px",
                              padding: "3px 8px",
                            }}
                          >
                            {item.notas}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {pedido.notas && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: tema.gold,
                        fontStyle: "italic",
                        background: `${tema.gold}15`,
                        borderRadius: "6px",
                        padding: "6px 10px",
                      }}
                    >
                      Nota: {pedido.notas}
                    </div>
                  )}
                  <div
                    style={{
                      ...st.pedidoFooter,
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <span style={st.pedidoTotal}>
                        ${Number(pedido.total).toLocaleString()}
                      </span>
                      <span style={{ fontSize: "11px", color: tema.textFaded }}>
                        {new Date(pedido.creadoEn).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                      <button
                        style={{
                          flex: 1,
                          background: tema.alertaBg,
                          color: tema.alertaText,
                          border: `1px solid ${tema.alertaBorder}`,
                          borderRadius: "8px",
                          padding: "10px",
                          fontWeight: "700",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                        onClick={async () => {
                          await api.patch(`/pedidos/${pedido.id}/rechazar`, {
                            motivo: "Rechazado por el empleado",
                          });
                          setSolicitudes((prev) =>
                            prev.filter((p) => p.id !== pedido.id),
                          );
                        }}
                      >
                        Rechazar
                      </button>
                      <button
                        style={{
                          flex: 2,
                          background: tema.accent,
                          color: tema.accentText,
                          border: "none",
                          borderRadius: "8px",
                          padding: "10px",
                          fontWeight: "800",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                        onClick={async () => {
                          await api.patch(`/pedidos/${pedido.id}/aprobar`);
                          setSolicitudes((prev) =>
                            prev.filter((p) => p.id !== pedido.id),
                          );
                        }}
                      >
                        Aprobar y enviar a cocina
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2 — Mis pedidos */}
      {tab === 2 && (
        <div style={st.content}>
          {misPedidos.length === 0 ? (
            <p style={st.vacio}>No hay pedidos activos</p>
          ) : (
            <div style={st.gridPedidos}>
              {misPedidos.map((pedido) => {
                const colorText =
                  COLOR_ESTADO_TEXT[pedido.estado] || tema.textSub;
                return (
                  <div key={pedido.id} style={{ ...st.pedidoCard }}>
                    <div style={st.pedidoHeader}>
                      <span style={st.pedidoNumero}>#{pedido.numero}</span>
                      {pedido.mesa && (
                        <span style={st.pedidoMesa}>Mesa {pedido.mesa}</span>
                      )}
                      <span style={{ ...st.pedidoEstado, color: colorText }}>
                        {COLORES_ESTADO[pedido.estado]?.label || pedido.estado}
                      </span>
                    </div>
                    <div style={st.pedidoItems}>
                      {pedido.items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <div style={st.pedidoItem}>
                            <span>
                              {item.cantidad}x {item.producto.nombre}
                            </span>
                            <span>
                              ${Number(item.subtotal).toLocaleString()}
                            </span>
                          </div>
                          {item.notas && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: tema.gold,
                                fontStyle: "italic",
                                paddingLeft: "8px",
                              }}
                            >
                              {item.notas}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={st.pedidoFooter}>
                      <span style={st.pedidoTotal}>
                        ${Number(pedido.total).toLocaleString()}
                      </span>
                      <button
                        style={st.btnCobrarDirecto}
                        onClick={() => irACobrarPedido(pedido)}
                      >
                        Cobrar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3 — Cobrar */}
      {tab === 3 && (
        <div style={st.content}>
          {cobrado ? (
            <div style={st.confirmadoBox}>
              <div
                style={{
                  ...st.checkIcon,
                  background: tema.verdeBg,
                  color: tema.verde,
                  border: `2px solid ${tema.verdeBorder}`,
                }}
              >
                $
              </div>
              <h2 style={st.confirmadoTitulo}>Cobrado correctamente</h2>
              {cobrado.mesa && (
                <p style={st.confirmadoSub}>Mesa {cobrado.mesa}</p>
              )}
              {cobrado.numeroPedido && (
                <p style={st.confirmadoSub}>Pedido #{cobrado.numeroPedido}</p>
              )}
              <p style={st.confirmadoSub}>{cobrado.metodoPago}</p>
              <div style={st.confirmadoTotal}>
                <span>Total cobrado</span>
                <span>${Number(cobrado.totalCobrado).toLocaleString()}</span>
              </div>
              <div style={st.confirmadoBtns}>
                <button
                  style={st.btnPrimario}
                  onClick={() => {
                    setCobrado(null);
                    setBusquedaCobro("");
                    setPedidosCobro([]);
                  }}
                >
                  Cobrar otro
                </button>
                <button
                  style={st.btnSecundario}
                  onClick={() =>
                    setTicketCobro({
                      numero: cobrado.numeroPedido || "-",
                      mesa: cobrado.mesa || "",
                      creadoEn: new Date().toISOString(),
                      total: cobrado.totalCobrado,
                      metodoPago: cobrado.metodoPago,
                      items: [],
                    })
                  }
                >
                  Imprimir ticket
                </button>
              </div>
            </div>
          ) : (
            <div style={st.cobrarContainer}>
              <div style={st.tipoSelector}>
                <button
                  style={{
                    ...st.tipoBtn,
                    ...(tipoBusqueda === "mesa" ? st.tipoBtnActivo : {}),
                  }}
                  onClick={() => {
                    setTipoBusqueda("mesa");
                    setBusquedaCobro("");
                    setPedidosCobro([]);
                  }}
                >
                  Por mesa
                </button>
                <button
                  style={{
                    ...st.tipoBtn,
                    ...(tipoBusqueda === "numero" ? st.tipoBtnActivo : {}),
                  }}
                  onClick={() => {
                    setTipoBusqueda("numero");
                    setBusquedaCobro("");
                    setPedidosCobro([]);
                  }}
                >
                  Por N° pedido
                </button>
              </div>

              <div style={st.cobrarBusqueda}>
                <input
                  type="text"
                  placeholder={
                    tipoBusqueda === "mesa"
                      ? "Número de mesa"
                      : "Número de pedido"
                  }
                  value={busquedaCobro}
                  onChange={(e) => setBusquedaCobro(e.target.value)}
                  style={st.inputMesa}
                  onKeyDown={(e) => e.key === "Enter" && buscarParaCobrar()}
                />
                <button style={st.btnSecundario} onClick={buscarParaCobrar}>
                  Buscar
                </button>
              </div>

              {pedidosCobro.length > 0 && (
                <>
                  <div style={st.resumenMesa}>
                    <h4 style={st.resumenTitulo}>
                      {tipoBusqueda === "mesa"
                        ? `Mesa ${busquedaCobro}`
                        : `Pedido #${busquedaCobro}`}
                    </h4>
                    {pedidosCobro.map((pedido) => (
                      <div key={pedido.id} style={st.resumenPedido}>
                        <span style={st.resumenNumero}>
                          Pedido #{pedido.numero}{" "}
                          {pedido.mesa ? `— Mesa ${pedido.mesa}` : ""}
                        </span>
                        {pedido.items.map((item) => (
                          <div key={item.id} style={st.resumenItem}>
                            <span>
                              {item.cantidad}x {item.producto.nombre}
                            </span>
                            <span>
                              ${Number(item.subtotal).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        <div
                          style={{
                            ...st.resumenItem,
                            fontWeight: "600",
                            borderTop: `1px solid ${tema.separador}`,
                            paddingTop: "6px",
                            marginTop: "4px",
                          }}
                        >
                          <span>Subtotal</span>
                          <span>${Number(pedido.total).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    <div style={st.resumenTotal}>
                      <span>Total a cobrar</span>
                      <span style={st.resumenTotalNum}>
                        ${totalCobro.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={st.metodoPagoContainer}>
                    <h4 style={st.metodoPagoTitulo}>Método de pago</h4>
                    <div style={st.metodoPagoBtns}>
                      {["EFECTIVO", "QR", "TRANSFERENCIA"].map((metodo) => (
                        <button
                          key={metodo}
                          style={{
                            ...st.metodoPagoBtn,
                            ...(metodoPago === metodo
                              ? st.metodoPagoBtnActivo
                              : {}),
                          }}
                          onClick={() => setMetodoPago(metodo)}
                        >
                          {metodo === "EFECTIVO"
                            ? "Efectivo"
                            : metodo === "QR"
                              ? "QR / MP"
                              : "Transferencia"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      background: `${tema.gold}12`,
                      border: `1px solid ${tema.borderFaded}`,
                      borderRadius: "10px",
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        color: tema.textFaded,
                        marginBottom: "10px",
                      }}
                    >
                      Confirmar cobro de ${totalCobro.toLocaleString()} por{" "}
                      {metodoPago === "EFECTIVO"
                        ? "Efectivo"
                        : metodoPago === "QR"
                          ? "QR / Mercado Pago"
                          : "Transferencia"}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        style={{
                          flex: 1,
                          background: "transparent",
                          color: tema.textFaded,
                          border: `1px solid ${tema.borderFaded}`,
                          borderRadius: "8px",
                          padding: "11px",
                          fontWeight: "600",
                          fontSize: "14px",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setPedidosCobro([]);
                          setBusquedaCobro("");
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        style={{
                          flex: 2,
                          background: tema.accent,
                          color: tema.accentText,
                          border: "none",
                          borderRadius: "8px",
                          padding: "11px",
                          fontWeight: "800",
                          fontSize: "15px",
                          cursor: "pointer",
                        }}
                        onClick={abrirPantallaPago}
                      >
                        Cobrar ${totalCobro.toLocaleString()}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {pedidosCobro.length === 0 && busquedaCobro && (
                <p style={st.vacio}>No se encontraron pedidos activos</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* GLOBALES */}
      {pantallaPago && (
        <PantallaPago
          pedido={pantallaPago}
          metodoPago={metodoPago}
          onCambiarMetodo={setMetodoPago}
          onPagoConfirmado={confirmarPagoReal}
        />
      )}
      {ticketCobro && (
        <Ticket
          pedido={ticketCobro}
          razonSocial={razonSocial}
          onCerrar={() => setTicketCobro(null)}
        />
      )}
    </div>
  );
}

function getStyles(t) {
  return {
    container: {
      minHeight: "100vh",
      background: t.bg,
      display: "flex",
      flexDirection: "column",
      color: t.text,
    },
    header: {
      background: t.bgHeader,
      padding: "1rem 1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${t.borderFaded}`,
    },
    headerNombre: {
      color: t.temaActual === "natural" ? "#F2F2F2" : t.gold,
      fontWeight: "800",
      fontSize: "1.1rem",
    },
    headerUsuario: { color: t.textSidebar, fontSize: "12px", marginTop: "2px" },
    btnLogout: {
      background: "transparent",
      border: `1px solid rgba(255,255,255,0.3)`,
      color: "rgba(255,255,255,0.8)",
      borderRadius: "8px",
      padding: "6px 14px",
      cursor: "pointer",
      fontSize: "13px",
    },
    tabs: {
      display: "flex",
      background: t.bgHeader,
      borderBottom: `1px solid ${t.borderFaded}`,
    },
    tab: {
      flex: 1,
      padding: "14px 8px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      color: t.textSidebar,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
    },
    tabActivo: {
      color: t.temaActual === "natural" ? "#F2F2F2" : t.gold,
      borderBottom: `2px solid ${t.gold}`,
    },
    tabBadge: {
      background: t.gold,
      color: t.accentText,
      borderRadius: "10px",
      padding: "1px 7px",
      fontSize: "11px",
      fontWeight: "800",
    },
    content: { flex: 1, padding: "1rem", overflowY: "auto" },
    layoutDos: {
      display: "grid",
      gridTemplateColumns: "1fr 340px",
      gap: "1rem",
    },
    panelMenu: { display: "flex", flexDirection: "column", gap: "10px" },
    buscador: {
      padding: "10px 14px",
      borderRadius: "10px",
      border: `1px solid ${t.borderFaded}`,
      fontSize: "14px",
      width: "100%",
      boxSizing: "border-box",
      background: t.inputBg,
      color: t.text,
    },
    categorias: { display: "flex", gap: "8px", flexWrap: "wrap" },
    catBtn: {
      padding: "7px 16px",
      borderRadius: "20px",
      border: `1px solid ${t.borderFaded}`,
      background: "transparent",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      color: t.textSub,
    },
    catBtnActivo: {
      background: t.accent,
      color: t.accentText,
      border: `1px solid ${t.accent}`,
    },
    listaProductos: { display: "flex", flexDirection: "column", gap: "6px" },
    productoRow: {
      background: t.bgCard,
      borderRadius: "10px",
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    productoInfo: { display: "flex", flexDirection: "column", gap: "2px" },
    productoNombre: { fontSize: "14px", fontWeight: "700", color: t.text },
    productoPrecio: { fontSize: "13px", color: t.gold, fontWeight: "600" },
    contador: { display: "flex", alignItems: "center", gap: "8px" },
    btnContador: {
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      background: t.bgLight,
      border: `1px solid ${t.borderFaded}`,
      fontSize: "18px",
      cursor: "pointer",
      fontWeight: "700",
      color: t.gold,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    btnContadorPrimario: {
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      background: t.accent,
      color: t.accentText,
      border: "none",
      fontSize: "18px",
      cursor: "pointer",
      fontWeight: "800",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    cantidadContador: {
      fontSize: "15px",
      fontWeight: "800",
      minWidth: "20px",
      textAlign: "center",
      color: t.gold,
    },
    panelCarrito: {
      background: t.bgSidebar,
      borderRadius: "14px",
      padding: "1rem",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      height: "fit-content",
      position: "sticky",
      top: "1rem",
      border: `1px solid ${t.borderFaded}`,
    },
    carritoTitulo: {
      fontSize: "16px",
      fontWeight: "800",
      margin: 0,
      color: t.temaActual === "natural" ? "#F2F2F2" : t.gold,
    },
    inputMesa: {
      padding: "10px 14px",
      borderRadius: "10px",
      border: `1px solid ${t.borderFaded}`,
      fontSize: "14px",
      width: "100%",
      boxSizing: "border-box",
      background: t.bg,
      color: t.text,
    },
    carritoVacio: {
      color: t.textFaded,
      fontSize: "13px",
      textAlign: "center",
      padding: "1rem 0",
    },
    carritoItems: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      maxHeight: "300px",
      overflowY: "auto",
    },
    carritoItem: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      paddingBottom: "8px",
      borderBottom: `1px solid ${t.separador}`,
    },
    carritoItemInfo: { flex: 1, display: "flex", flexDirection: "column" },
    carritoItemNombre: {
      fontSize: "13px",
      fontWeight: "700",
      color: t.temaActual === "natural" ? "#F2F2F2" : t.text,
    },
    carritoItemSub: {
      fontSize: "11px",
      color: t.temaActual === "natural" ? "rgba(255,255,255,0.5)" : t.textFaded,
    },
    carritoItemTotal: {
      fontSize: "13px",
      fontWeight: "700",
      minWidth: "60px",
      textAlign: "right",
      color: t.gold,
    },
    notasInput: {
      padding: "10px 14px",
      borderRadius: "10px",
      border: `1px solid ${t.borderFaded}`,
      fontSize: "13px",
      resize: "none",
      fontFamily: "inherit",
      width: "100%",
      boxSizing: "border-box",
      background: t.bg,
      color: t.text,
    },
    carritoFooter: {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      borderTop: `1px solid ${t.separador}`,
      paddingTop: "10px",
    },
    carritoTotal: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "15px",
      fontWeight: "600",
      color: t.temaActual === "natural" ? "#F2F2F2" : t.text,
    },
    carritoTotalNum: { fontSize: "1.3rem", fontWeight: "900", color: t.gold },
    btnPrimario: {
      background: t.accent,
      color: t.accentText,
      border: "none",
      borderRadius: "10px",
      padding: "13px",
      fontWeight: "800",
      fontSize: "15px",
      cursor: "pointer",
      width: "100%",
    },
    btnSecundario: {
      background: "transparent",
      color: t.text,
      border: `1.5px solid ${t.borderFaded}`,
      borderRadius: "10px",
      padding: "10px 20px",
      fontWeight: "600",
      fontSize: "14px",
      cursor: "pointer",
    },
    gridPedidos: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: "12px",
    },
    pedidoCard: {
      borderRadius: "14px",
      padding: "1rem",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      border: `1px solid ${t.borderFaded}`,
      background: t.bgCard,
    },
    pedidoHeader: { display: "flex", alignItems: "center", gap: "8px" },
    pedidoNumero: {
      fontSize: "1.3rem",
      fontWeight: "900",
      color: t.gold,
      fontFamily: "Georgia, serif",
    },
    pedidoMesa: {
      background: t.btnActivo,
      border: `1px solid ${t.borderFaded}`,
      borderRadius: "6px",
      padding: "2px 8px",
      fontSize: "12px",
      fontWeight: "700",
      color: t.gold,
    },
    pedidoEstado: { marginLeft: "auto", fontSize: "12px", fontWeight: "700" },
    pedidoItems: { display: "flex", flexDirection: "column", gap: "4px" },
    pedidoItem: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "13px",
      color: t.text,
    },
    pedidoFooter: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderTop: `1px solid ${t.separador}`,
      paddingTop: "8px",
      marginTop: "4px",
    },
    pedidoTotal: { fontSize: "15px", fontWeight: "800", color: t.gold },
    btnCobrarDirecto: {
      background: t.accent,
      color: t.accentText,
      border: "none",
      borderRadius: "8px",
      padding: "6px 16px",
      fontSize: "13px",
      fontWeight: "800",
      cursor: "pointer",
    },
    vacio: {
      color: t.textFaded,
      textAlign: "center",
      padding: "3rem",
      fontSize: "14px",
    },
    confirmadoBox: {
      maxWidth: "400px",
      margin: "2rem auto",
      background: t.bgCard,
      borderRadius: "20px",
      padding: "2rem",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      border: `1px solid ${t.borderFaded}`,
    },
    checkIcon: {
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      background: t.verdeBg,
      color: t.verde,
      fontSize: "1.8rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: "0 auto",
      fontWeight: "700",
      border: `2px solid ${t.verdeBorder}`,
    },
    confirmadoTitulo: {
      fontSize: "1.3rem",
      fontWeight: "800",
      margin: 0,
      color: t.gold,
      fontFamily: "Georgia, serif",
    },
    confirmadoSub: { color: t.textFaded, fontSize: "14px", margin: 0 },
    confirmadoItems: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      textAlign: "left",
    },
    confirmadoItem: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "13px",
      padding: "4px 0",
      borderBottom: `1px solid ${t.separador}`,
      color: t.text,
    },
    confirmadoTotal: {
      display: "flex",
      justifyContent: "space-between",
      fontWeight: "800",
      fontSize: "15px",
      paddingTop: "4px",
      color: t.gold,
    },
    confirmadoBtns: { display: "flex", flexDirection: "column", gap: "8px" },
    cobrarContainer: {
      maxWidth: "500px",
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    },
    cobrarBusqueda: { display: "flex", gap: "10px" },
    resumenMesa: {
      background: t.bgCard,
      borderRadius: "14px",
      padding: "1rem",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      border: `1px solid ${t.borderFaded}`,
    },
    resumenTitulo: {
      fontWeight: "800",
      margin: 0,
      fontSize: "15px",
      color: t.gold,
    },
    resumenPedido: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      paddingBottom: "8px",
      borderBottom: `1px solid ${t.separador}`,
    },
    resumenNumero: { fontSize: "12px", fontWeight: "700", color: t.textFaded },
    resumenItem: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "13px",
      color: t.text,
    },
    resumenTotal: {
      display: "flex",
      justifyContent: "space-between",
      fontWeight: "800",
      fontSize: "16px",
      paddingTop: "4px",
      color: t.gold,
    },
    resumenTotalNum: { fontSize: "1.3rem", fontWeight: "900" },
    metodoPagoContainer: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
    metodoPagoTitulo: {
      fontWeight: "700",
      margin: 0,
      fontSize: "14px",
      color: t.text,
    },
    metodoPagoBtns: { display: "flex", gap: "8px" },
    metodoPagoBtn: {
      flex: 1,
      padding: "10px",
      borderRadius: "10px",
      border: `1px solid ${t.borderFaded}`,
      background: "transparent",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      color: t.textSub,
    },
    metodoPagoBtnActivo: {
      background: t.accent,
      color: t.accentText,
      border: `1px solid ${t.accent}`,
      fontWeight: "800",
    },
    tipoSelector: { display: "flex", gap: "8px" },
    tipoBtn: {
      flex: 1,
      padding: "10px",
      borderRadius: "10px",
      border: `1px solid ${t.borderFaded}`,
      background: "transparent",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "600",
      color: t.textSub,
    },
    tipoBtnActivo: {
      background: t.accent,
      color: t.accentText,
      border: `1px solid ${t.accent}`,
      fontWeight: "800",
    },
  };
}
