import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  useMenuConfig,
  buildPaleta,
  getFuente,
  cargarFuente,
  mezclar,
} from "../utils/menuConfig";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API;
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const dinero = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;

const normalizar = (t) =>
  (t || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// ─── Íconos (trazo, sin emojis) ───────────────────────────────

const ICONOS = {
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
  check: <path d="M5 13l4 4L19 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  coffee: (
    <>
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <path d="M6 1v3M10 1v3M14 1v3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
};

function Icono({ nombre, size = 20, stroke = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONOS[nombre]}
    </svg>
  );
}

// ─── Seguimiento del pedido ───────────────────────────────────

const PASOS = [
  { id: "ENVIADO", label: "Enviado", icono: "clock" },
  { id: "CONFIRMADO", label: "Confirmado", icono: "check" },
  { id: "PREPARANDO", label: "Preparando", icono: "coffee" },
  { id: "LISTO", label: "Listo", icono: "bell" },
];

const ESTADOS = {
  ESPERANDO_APROBACION: {
    paso: 0,
    icono: "clock",
    tono: "prim",
    titulo: "Esperando confirmación",
    texto: "El local está revisando tu pedido.",
  },
  PENDIENTE: {
    paso: 1,
    icono: "check",
    tono: "ok",
    titulo: "¡Pedido confirmado!",
    texto: "Ya lo recibió cocina, en breve empiezan a prepararlo.",
  },
  EN_PREPARACION: {
    paso: 2,
    icono: "coffee",
    tono: "info",
    titulo: "Lo están preparando",
    texto: "Cocina está trabajando en tu pedido.",
  },
  LISTO: {
    paso: 3,
    icono: "bell",
    tono: "ok",
    titulo: "¡Tu pedido está listo!",
    texto: "Pasá a retirarlo o el mozo te lo lleva enseguida.",
  },
  ENTREGADO: {
    paso: 4,
    icono: "check",
    tono: "ok",
    titulo: "¡Que lo disfrutes!",
    texto: "Tu pedido fue entregado. Gracias por la visita.",
  },
  COBRADO: {
    paso: 4,
    icono: "check",
    tono: "ok",
    titulo: "Pedido cobrado",
    texto: "Gracias por tu visita.",
  },
  CANCELADO: {
    paso: 0,
    icono: "close",
    tono: "error",
    titulo: "Pedido cancelado",
    texto: "El pedido fue cancelado por el local.",
  },
  RECHAZADO: {
    paso: 0,
    icono: "close",
    tono: "error",
    titulo: "Pedido rechazado",
    texto: "El local no pudo aceptar tu pedido.",
  },
};

const normalizarEstado = (estado) => {
  if (estado === "ENVIADO") return "ESPERANDO_APROBACION";
  if (estado === "CONFIRMADO") return "PENDIENTE";
  if (estado === "PREPARANDO") return "EN_PREPARACION";
  return estado || "ESPERANDO_APROBACION";
};

export default function MenuCliente() {
  // ── Estado original de la pantalla ──
  const [searchParams] = useSearchParams();
  const mesaQR = searchParams.get("mesa") || "";
  const { config: cfg } = useMenuConfig();
  const P = buildPaleta(cfg);

  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [hoja, setHoja] = useState(null);
  const [verCarrito, setVerCarrito] = useState(false);
  const [mesa, setMesa] = useState(mesaQR);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [pedidoEnviado, setPedidoEnviado] = useState(null);

  const seccionRefs = useRef({});
  const chipRefs = useRef({});

  // ── Productos / carrito ──
  const itemEn = (id) => carrito.find((i) => i.id === id);

  const maximoDe = (p) => Math.max(0, Number(p.stock ?? 99));

  const fijarCantidad = (producto, cantidad, nota) => {
    const max = maximoDe(producto);
    const val = Math.max(0, Math.min(max, Number(cantidad) || 0));
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === producto.id);
      if (val === 0) return prev.filter((i) => i.id !== producto.id);
      if (existe) return prev.map((i) => (i.id === producto.id ? { ...i, cantidad: val, nota: nota ?? i.nota ?? "" } : i));
      return [...prev, { ...producto, cantidad: val, nota: nota ?? "" }];
    });
  };

  const sumar = (p) => {
    const actual = itemEn(p.id)?.cantidad || 0;
    if (actual >= maximoDe(p)) return;
    fijarCantidad(p, actual + 1);
  };

  const restar = (p) => fijarCantidad(p, (itemEn(p.id)?.cantidad || 0) - 1);

  const cambiarNota = (id, nota) =>
    setCarrito((prev) => prev.map((i) => (i.id === id ? { ...i, nota } : i)));

  const total = carrito.reduce((acc, i) => acc + Number(i.precio) * i.cantidad, 0);
  const cantidadTotal = carrito.reduce((acc, i) => acc + i.cantidad, 0);

  // ── Hoja de producto ──
  const abrirHoja = (producto) => {
    const it = itemEn(producto.id);
    setHoja({ producto, cantidad: it?.cantidad || 1, nota: it?.nota || "" });
  };

  const confirmarHoja = () => {
    fijarCantidad(hoja.producto, hoja.cantidad, hoja.nota);
    setHoja(null);
  };

  // Bloqueo de scroll y tecla Escape
  useEffect(() => {
    document.body.style.overflow = hoja || verCarrito ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [hoja, verCarrito]);

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === "Escape") {
        setHoja(null);
        setVerCarrito(false);
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // ── Envío del pedido ──
  const enviarPedido = async () => {
    if (carrito.length === 0 || enviando) return;
    setEnviando(true);
    setErrorEnvio("");
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
      if (!r.ok) throw new Error(data.error || "No se pudo enviar el pedido");
      setPedidoEnviado({ ...data, estadoSeguimiento: "ESPERANDO_APROBACION" });
      setCarrito([]);
      setVerCarrito(false);
    } catch (e) {
      setErrorEnvio(e.message || "No se pudo enviar el pedido. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Seguimiento en tiempo real ──
  useEffect(() => {
    const pedidoId = pedidoEnviado?.id;
    if (!pedidoId) return;

    const socket = io(SOCKET_URL, { transports: ["websocket"], reconnection: true });

    const aplicarPedido = (p) => {
      if (!p || p.id !== pedidoId) return;
      setPedidoEnviado((prev) => ({
        ...(prev || {}),
        ...p,
        // El backend puede devolver estado y datos del pedido sin estadoSeguimiento.
        // Conservamos el estado visual si no viene en el evento.
        estadoSeguimiento: normalizarEstado(p.estado || prev?.estadoSeguimiento),
      }));
    };

    socket.on("pedido_aprobado", (p) => {
      if (p?.id !== pedidoId) return;
      setPedidoEnviado((prev) => ({ ...(prev || {}), ...p, estadoSeguimiento: "PENDIENTE" }));
    });

    socket.on("pedido_modificado", aplicarPedido);

    socket.on("pedido_rechazado", ({ pedidoId: id }) => {
      if (id === pedidoId) {
        setPedidoEnviado((prev) => (prev ? { ...prev, estadoSeguimiento: "RECHAZADO" } : prev));
        socket.disconnect();
      }
    });

    socket.on("pedido_actualizado", aplicarPedido);

    return () => socket.disconnect();
  }, [pedidoEnviado?.id]);

  // ── Variables CSS (todo el diseño se tiñe con estos valores) ──
  const vars = {
    "--bg": P.fondo,
    "--card": P.card,
    "--texto": P.texto,
    "--suave": P.textoSuave,
    "--tenue": P.textoTenue,
    "--borde": P.borde,
    "--borde-prim": P.bordePrimario,
    "--prim": P.primario,
    "--sobre-prim": P.sobrePrimario,
    "--prim-suave": P.primarioSuave,
    "--sombra": P.sombra,
    "--vidrio": P.vidrio,
    "--hero-grad": `linear-gradient(135deg, ${mezclar(P.primario, P.fondo, 0.62)} 0%, ${P.fondo} 100%)`,
    fontFamily: SANS,
  };

  // ── Carga de datos / resto de la implementación original ──
  // Este bloque se mantiene desde la versión existente del componente.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        setCargando(true);
        const r = await fetch(`${API}/productos/publico`);
        if (!r.ok) throw new Error("No se pudieron cargar los productos");
        const data = await r.json();
        if (!vivo) return;
        const lista = Array.isArray(data) ? data : data.productos || [];
        setProductos(lista);
        const cats = [...new Map(lista.map((p) => [p.categoria?.id || p.categoriaId || p.categoria || "general", p.categoria])).entries()]
          .map(([id, nombre]) => ({ id, nombre: typeof nombre === "string" ? nombre : nombre?.nombre || "General" }));
        setCategorias(cats);
        setCategoriaActiva(cats[0]?.id || "");
      } catch (e) {
        if (vivo) setError(e.message || "No se pudieron cargar los productos");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const productosFiltrados = useMemo(() => {
    const q = normalizar(busqueda);
    return productos.filter((p) => {
      const categoriaId = p.categoria?.id || p.categoriaId || p.categoria || "general";
      const okCat = !categoriaActiva || String(categoriaId) === String(categoriaActiva);
      const okQ = !q || normalizar(p.nombre).includes(q) || normalizar(p.descripcion).includes(q);
      return okCat && okQ;
    });
  }, [productos, categoriaActiva, busqueda]);

  if (cargando) return <div style={vars}>Cargando menú…</div>;
  if (error) return <div style={vars}>{error}</div>;

  return (
    <div className="mc-page" style={vars}>
      <header className="mc-header">
        <div className="mc-brand">HaceCafé</div>
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" />
      </header>

      <main>
        <div className="mc-categorias">
          {categorias.map((c) => (
            <button key={c.id} className={String(categoriaActiva) === String(c.id) ? "active" : ""} onClick={() => setCategoriaActiva(c.id)}>{c.nombre}</button>
          ))}
        </div>

        <section className="mc-productos">
          {productosFiltrados.map((p) => {
            const item = itemEn(p.id);
            return (
              <article key={p.id} className="mc-producto">
                <div className="mc-producto-info">
                  <h3>{p.nombre}</h3>
                  {p.descripcion && <p>{p.descripcion}</p>}
                  <strong>{dinero(p.precio)}</strong>
                </div>
                <div className="mc-producto-actions">
                  <button onClick={() => restar(p)} disabled={!item}>−</button>
                  <span>{item?.cantidad || 0}</span>
                  <button onClick={() => sumar(p)}>+</button>
                  <button onClick={() => abrirHoja(p)}>Detalle</button>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      {verCarrito && (
        <div className="mc-modal">
          <div className="mc-carrito">
            <h2>Tu pedido</h2>
            {carrito.map((i) => (
              <div key={i.id} className="mc-carrito-row">
                <span>{i.cantidad} × {i.nombre}</span>
                <b>{dinero(Number(i.precio) * i.cantidad)}</b>
              </div>
            ))}
            <div className="mc-carrito-total"><span>Total</span><b>{dinero(total)}</b></div>
            <button onClick={enviarPedido} disabled={enviando}>Enviar pedido</button>
            {errorEnvio && <p>{errorEnvio}</p>}
          </div>
        </div>
      )}

      <button className="mc-float-cart" onClick={() => setVerCarrito(true)}>Pedido ({cantidadTotal})</button>

      {pedidoEnviado && (
        <section className="mc-track">
          <div className="mc-track-num">Pedido #{pedidoEnviado.numero || pedidoEnviado.id}</div>
          <h1>{ESTADOS[pedidoEnviado.estadoSeguimiento || normalizarEstado(pedidoEnviado.estado)]?.titulo || "Seguimiento del pedido"}</h1>
          <p>{ESTADOS[pedidoEnviado.estadoSeguimiento || normalizarEstado(pedidoEnviado.estado)]?.texto || ""}</p>
          <div className="mc-resumen">
            {pedidoEnviado.items?.map((item) => (
              <div className="mc-resumen-row" key={item.id}>
                <span>{item.cantidad} × {item.producto?.nombre || item.nombre || "Producto"}</span>
                <span>{dinero(item.subtotal ?? Number(item.precio || item.producto?.precio || 0) * Number(item.cantidad || 0))}</span>
              </div>
            ))}
            <div className="mc-resumen-total">
              <span>Total</span>
              <b className="mc-serif">{dinero(pedidoEnviado.total)}</b>
            </div>
          </div>
        </section>
      )}

      {hoja && (
        <div className="mc-modal" onClick={() => setHoja(null)}>
          <div className="mc-carrito" onClick={(e) => e.stopPropagation()}>
            <h2>{hoja.producto.nombre}</h2>
            <p>{hoja.producto.descripcion}</p>
            <input type="number" min="0" value={hoja.cantidad} onChange={(e) => setHoja((h) => ({ ...h, cantidad: Number(e.target.value) }))} />
            <textarea value={hoja.nota} onChange={(e) => setHoja((h) => ({ ...h, nota: e.target.value }))} placeholder="Notas" />
            <button onClick={confirmarHoja}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}
