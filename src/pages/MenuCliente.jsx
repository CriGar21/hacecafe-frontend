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
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
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
  RECHAZADO: {
    paso: -1,
    icono: "close",
    tono: "error",
    titulo: "No pudimos tomar tu pedido",
    texto: "Hablá con el mozo y lo resolvemos.",
  },
};

function normalizarEstado(e) {
  if (e === "APROBADO") return "PENDIENTE";
  if (e === "COBRADO") return "ENTREGADO";
  if (e === "CANCELADO") return "RECHAZADO";
  return e;
}

// ─── Componente principal ─────────────────────────────────────

export default function MenuCliente() {
  const [searchParams] = useSearchParams();
  const mesaQR = searchParams.get("mesa") || "";

  const cfg = useMenuConfig();
  const P = useMemo(() => buildPaleta(cfg), [cfg]);
  const fuente = getFuente(cfg.fuenteId);

  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [hoja, setHoja] = useState(null); // { producto, cantidad, nota }
  const [verCarrito, setVerCarrito] = useState(false);
  const [mesa, setMesa] = useState(mesaQR);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [pedidoEnviado, setPedidoEnviado] = useState(null);

  const seccionRefs = useRef({});
  const chipRefs = useRef({});
  const chipsRef = useRef(null);
  const bloqueoSpy = useRef(false);

  // Fuente elegida en Apariencia
  useEffect(() => {
    cargarFuente(cfg.fuenteId);
  }, [cfg.fuenteId]);

  // Carga del menú
  useEffect(() => {
    let vivo = true;
    const pedir = (ruta) =>
      fetch(`${API}${ruta}`).then((r) => {
        if (!r.ok) throw new Error("fallo");
        return r.json();
      });

    Promise.all([pedir("/categorias"), pedir("/productos")])
      .then(([cats, prods]) => {
        if (!vivo) return;
        setCategorias(
          [...cats].sort((a, b) => (a.ordenDisplay ?? 999) - (b.ordenDisplay ?? 999)),
        );
        setProductos(prods);
      })
      .catch(() => vivo && setErrorCarga(true))
      .finally(() => vivo && setCargando(false));

    return () => {
      vivo = false;
    };
  }, []);

  // ── Datos derivados ──
  const visibles = useMemo(
    () => productos.filter((p) => p.disponible !== false),
    [productos],
  );

  const secciones = useMemo(
    () =>
      categorias
        .filter((c) => c.activa !== false)
        .map((c) => ({ ...c, items: visibles.filter((p) => p.categoriaId === c.id) }))
        .filter((c) => c.items.length > 0),
    [categorias, visibles],
  );

  const termino = normalizar(busqueda.trim());

  const resultados = useMemo(() => {
    if (!termino) return [];
    return visibles.filter(
      (p) =>
        normalizar(p.nombre).includes(termino) ||
        normalizar(p.descripcion).includes(termino),
    );
  }, [visibles, termino]);

  const activa = categoriaActiva ?? secciones[0]?.id ?? null;

  // ── Categoría activa según el scroll ──
  useEffect(() => {
    if (termino || secciones.length === 0) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (bloqueoSpy.current) return;
        entradas.forEach((e) => {
          if (e.isIntersecting) setCategoriaActiva(Number(e.target.dataset.cat));
        });
      },
      { rootMargin: "-140px 0px -65% 0px", threshold: 0 },
    );
    Object.values(seccionRefs.current).forEach((el) => el && observador.observe(el));
    return () => observador.disconnect();
  }, [secciones, termino]);

  // Mantiene visible el chip activo (solo mueve la barra de chips, no la página)
  useEffect(() => {
    const contenedor = chipsRef.current;
    const chip = chipRefs.current[activa];
    if (!contenedor || !chip) return;
    contenedor.scrollTo({
      left: chip.offsetLeft - contenedor.clientWidth / 2 + chip.clientWidth / 2,
      behavior: "smooth",
    });
  }, [activa]);

  const irASeccion = (id) => {
    setBusqueda("");
    setCategoriaActiva(id);
    bloqueoSpy.current = true;
    requestAnimationFrame(() => {
      seccionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setTimeout(() => {
      bloqueoSpy.current = false;
    }, 900);
  };

  // ── Carrito ──
  const itemEn = (id) => carrito.find((i) => i.id === id);

  const agotado = (p) =>
    p.sinStock === true || (typeof p.stockActual === "number" && p.stockActual <= 0);

  const maximoDe = (p) => (typeof p.stockActual === "number" ? p.stockActual : 99);

  const fijarCantidad = (producto, cantidad, nota) => {
    setCarrito((prev) => {
      if (cantidad <= 0) return prev.filter((i) => i.id !== producto.id);
      const existe = prev.find((i) => i.id === producto.id);
      if (existe) {
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad, nota: nota ?? i.nota } : i,
        );
      }
      return [...prev, { ...producto, cantidad, nota: nota ?? "" }];
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
    const fijarEstado = (estado) =>
      setPedidoEnviado((prev) => (prev ? { ...prev, estadoSeguimiento: estado } : prev));

    socket.on("pedido_aprobado", (p) => {
      if (p.id === pedidoId) fijarEstado("PENDIENTE");
    });
    socket.on("pedido_rechazado", ({ pedidoId: id }) => {
      if (id === pedidoId) {
        fijarEstado("RECHAZADO");
        socket.disconnect();
      }
    });
    socket.on("pedido_actualizado", (p) => {
      if (p.id !== pedidoId) return;
      fijarEstado(normalizarEstado(p.estado));
      if (["ENTREGADO", "COBRADO", "CANCELADO"].includes(p.estado)) socket.disconnect();
    });

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
    "--fuente": fuente,
    "--sans": SANS,
    "--ok": P.ok,
    "--info": P.info,
    "--error": P.error,
  };

  // ─── Pantalla de seguimiento ────────────────────────────────
  if (pedidoEnviado) {
    const info = ESTADOS[pedidoEnviado.estadoSeguimiento] || ESTADOS.ESPERANDO_APROBACION;
    const tonos = { prim: P.primario, ok: P.ok, info: P.info, error: P.error };
    const enCurso = info.paso >= 0 && info.paso < 3;
    const terminado = info.paso === 4 || info.paso === -1;
    const mesaPedido = pedidoEnviado.mesa || mesa;

    return (
      <div className="mc mc-center" style={vars}>
        <Estilos />
        <div className="mc-track">
          <div
            className={`mc-track-ring ${enCurso ? "pulse" : ""}`}
            style={{ "--c": tonos[info.tono] }}
          >
            <Icono nombre={info.icono} size={34} />
          </div>
          <div className="mc-track-num">
            Pedido #{pedidoEnviado.numero}
            {mesaPedido ? ` · Mesa ${mesaPedido}` : ""}
          </div>
          <h1 className="mc-serif">{info.titulo}</h1>
          <p className="mc-track-text">{info.texto}</p>

          {info.paso >= 0 && (
            <div className="mc-steps">
              <div className="mc-steps-line" />
              <div
                className="mc-steps-fill"
                style={{ width: `${(Math.min(info.paso, 3) / 3) * 75}%` }}
              />
              {PASOS.map((p, i) => {
                const hecho = i < info.paso;
                const actual = i === info.paso;
                return (
                  <div
                    key={p.id}
                    className={`mc-step-i ${hecho ? "done" : ""} ${actual ? "now" : ""}`}
                  >
                    <div className="mc-dot">
                      <Icono nombre={hecho ? "check" : p.icono} size={16} />
                    </div>
                    <span>{p.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mc-resumen">
            {pedidoEnviado.items?.map((item) => (
              <div className="mc-resumen-row" key={item.id}>
                <span>
                  {item.cantidad} × {item.producto?.nombre}
                </span>
                <span>{dinero(item.subtotal)}</span>
              </div>
            ))}
            <div className="mc-resumen-total">
              <span>Total</span>
              <b className="mc-serif">{dinero(pedidoEnviado.total)}</b>
            </div>
          </div>

          {terminado && (
            <button className="mc-cta full" onClick={() => setPedidoEnviado(null)}>
              <span>{info.paso === -1 ? "Volver al menú" : "Hacer otro pedido"}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Menú ───────────────────────────────────────────────────
  const renderFila = (p) => (
    <Fila
      key={p.id}
      producto={p}
      cantidad={itemEn(p.id)?.cantidad || 0}
      agotado={agotado(p)}
      onAbrir={() => abrirHoja(p)}
      onSumar={() => sumar(p)}
      onRestar={() => restar(p)}
    />
  );

  return (
    <div className="mc" style={vars}>
      <Estilos />

      <header>
        <div className="mc-hero">
          {cfg.heroBgUrl && <img src={cfg.heroBgUrl} alt="" />}
        </div>
        <div className="mc-wrap">
          <div className="mc-head">
            {cfg.logoUrl ? (
              <img className="mc-logo" src={cfg.logoUrl} alt={cfg.nombre} />
            ) : (
              <div className="mc-logo mc-mono">
                {(cfg.nombre || "M").charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="mc-serif">{cfg.nombre}</h1>
            {cfg.subtitulo && <div className="mc-sub">{cfg.subtitulo}</div>}
            {cfg.bienvenida && <p className="mc-welcome">{cfg.bienvenida}</p>}
            <div className="mc-pills">
              {mesa && <span className="mc-pill on">Mesa {mesa}</span>}
              <span className="mc-pill">Pedí desde tu celular</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mc-sticky">
        <div className="mc-wrap">
          <label className="mc-search">
            <Icono nombre="search" size={18} />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el menú"
            />
            {busqueda && (
              <button
                type="button"
                className="mc-clear"
                onClick={() => setBusqueda("")}
                aria-label="Borrar búsqueda"
              >
                <Icono nombre="close" size={14} />
              </button>
            )}
          </label>

          {!termino && secciones.length > 1 && (
            <div className="mc-chips" ref={chipsRef}>
              {secciones.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  ref={(el) => (chipRefs.current[s.id] = el)}
                  className={`mc-chip ${activa === s.id ? "on" : ""}`}
                  onClick={() => irASeccion(s.id)}
                >
                  {s.icono ? `${s.icono} ` : ""}
                  {s.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="mc-wrap mc-main">
        {cargando && (
          <div className="mc-sec">
            <div className="mc-skel" />
            <div className="mc-skel" />
            <div className="mc-skel" />
          </div>
        )}

        {!cargando && errorCarga && (
          <div className="mc-empty">
            <p>No pudimos cargar el menú.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !errorCarga && termino && (
          <section className="mc-sec">
            <div className="mc-sec-title">
              <h2 className="mc-serif">Resultados</h2>
              <span>{resultados.length}</span>
            </div>
            {resultados.length > 0 ? (
              <div className="mc-list">{resultados.map(renderFila)}</div>
            ) : (
              <div className="mc-empty">
                <p>Nada coincide con “{busqueda}”.</p>
                <button type="button" onClick={() => setBusqueda("")}>
                  Ver todo el menú
                </button>
              </div>
            )}
          </section>
        )}

        {!cargando &&
          !errorCarga &&
          !termino &&
          secciones.map((s) => (
            <section
              key={s.id}
              className="mc-sec"
              data-cat={s.id}
              ref={(el) => (seccionRefs.current[s.id] = el)}
            >
              <div className="mc-sec-title">
                <h2 className="mc-serif">{s.nombre}</h2>
                <span>{s.items.length}</span>
              </div>
              <div className="mc-list">{s.items.map(renderFila)}</div>
            </section>
          ))}

        {!cargando && !errorCarga && !termino && secciones.length === 0 && (
          <div className="mc-empty">
            <p>El menú todavía no tiene productos.</p>
          </div>
        )}
      </main>

      {cantidadTotal > 0 && !verCarrito && !hoja && (
        <button className="mc-bar" type="button" onClick={() => setVerCarrito(true)}>
          <span className="mc-bar-count">{cantidadTotal}</span>
          <span className="mc-bar-label">Ver mi pedido</span>
          <span className="mc-bar-total mc-serif">{dinero(total)}</span>
        </button>
      )}

      {hoja && (
        <HojaProducto
          hoja={hoja}
          setHoja={setHoja}
          enCarrito={Boolean(itemEn(hoja.producto.id))}
          maximo={maximoDe(hoja.producto)}
          agotado={agotado(hoja.producto)}
          onCerrar={() => setHoja(null)}
          onConfirmar={confirmarHoja}
        />
      )}

      {verCarrito && (
        <HojaCarrito
          carrito={carrito}
          total={total}
          mesa={mesa}
          setMesa={setMesa}
          mesaFija={Boolean(mesaQR)}
          enviando={enviando}
          error={errorEnvio}
          onCerrar={() => setVerCarrito(false)}
          onSumar={sumar}
          onRestar={restar}
          onNota={cambiarNota}
          onEnviar={enviarPedido}
        />
      )}
    </div>
  );
}

// ─── Piezas ───────────────────────────────────────────────────

function Stepper({ cantidad, onSumar, onRestar }) {
  return (
    <div className="mc-step" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={onRestar} aria-label="Quitar uno">
        <Icono nombre="minus" size={16} />
      </button>
      <b>{cantidad}</b>
      <button type="button" onClick={onSumar} aria-label="Agregar uno">
        <Icono nombre="plus" size={16} />
      </button>
    </div>
  );
}

function Fila({ producto, cantidad, agotado, onAbrir, onSumar, onRestar }) {
  const inicial = (producto.nombre || "?").charAt(0).toUpperCase();

  return (
    <article className={`mc-prod ${agotado ? "off" : ""}`} onClick={onAbrir}>
      <div className="mc-prod-txt">
        <h3 className="mc-prod-name mc-serif">{producto.nombre}</h3>
        {producto.descripcion && <p className="mc-prod-desc">{producto.descripcion}</p>}
        <div className="mc-prod-foot">
          <span className="mc-price mc-serif">{dinero(producto.precio)}</span>
          {producto.tiempoPreparacion ? (
            <span className="mc-meta">
              <Icono nombre="clock" size={13} />
              {producto.tiempoPreparacion} min
            </span>
          ) : null}
        </div>
      </div>

      <div className="mc-prod-img">
        {producto.imagenUrl ? (
          <img
            src={producto.imagenUrl}
            alt={producto.nombre}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="mc-prod-ini mc-serif">{inicial}</span>
        )}

        {agotado ? (
          <span className="mc-off-badge">Agotado</span>
        ) : cantidad > 0 ? (
          <Stepper cantidad={cantidad} onSumar={onSumar} onRestar={onRestar} />
        ) : (
          <button
            type="button"
            className="mc-add"
            onClick={(e) => {
              e.stopPropagation();
              onSumar();
            }}
            aria-label={`Agregar ${producto.nombre}`}
          >
            <Icono nombre="plus" size={20} stroke={2.4} />
          </button>
        )}
      </div>
    </article>
  );
}

function HojaProducto({ hoja, setHoja, enCarrito, maximo, agotado, onCerrar, onConfirmar }) {
  const { producto, cantidad, nota } = hoja;
  const minimo = enCarrito ? 0 : 1;
  const inicial = (producto.nombre || "?").charAt(0).toUpperCase();

  const cambiar = (n) =>
    setHoja((h) => ({ ...h, cantidad: Math.max(minimo, Math.min(maximo, n)) }));

  return (
    <div className="mc-overlay" onClick={onCerrar}>
      <div
        className="mc-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={producto.nombre}
      >
        <div className="mc-sheet-img">
          {producto.imagenUrl ? (
            <img src={producto.imagenUrl} alt={producto.nombre} />
          ) : (
            <div className="mc-sheet-ph mc-serif">{inicial}</div>
          )}
          <button className="mc-close" type="button" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="close" size={18} />
          </button>
        </div>

        <div className="mc-sheet-body">
          <div className="mc-sheet-top">
            <h2 className="mc-serif">{producto.nombre}</h2>
            <span className="mc-price mc-serif big">{dinero(producto.precio)}</span>
          </div>

          {producto.tiempoPreparacion ? (
            <div className="mc-meta big">
              <Icono nombre="clock" size={15} />
              Se prepara en unos {producto.tiempoPreparacion} min
            </div>
          ) : null}

          {producto.descripcion && <p className="mc-sheet-desc">{producto.descripcion}</p>}

          <label className="mc-field">
            <span>Aclaración especial (opcional)</span>
            <textarea
              rows={2}
              value={nota}
              onChange={(e) => setHoja((h) => ({ ...h, nota: e.target.value }))}
              placeholder="Ej: sin azúcar, bien caliente, sin TACC…"
            />
          </label>
        </div>

        <div className="mc-sheet-foot">
          {agotado ? (
            <div className="mc-cta off">Producto agotado</div>
          ) : (
            <>
              <div className="mc-qty">
                <button
                  type="button"
                  onClick={() => cambiar(cantidad - 1)}
                  disabled={cantidad <= minimo}
                  aria-label="Quitar uno"
                >
                  <Icono nombre="minus" size={18} />
                </button>
                <b>{cantidad}</b>
                <button
                  type="button"
                  onClick={() => cambiar(cantidad + 1)}
                  disabled={cantidad >= maximo}
                  aria-label="Agregar uno"
                >
                  <Icono nombre="plus" size={18} />
                </button>
              </div>
              <button className="mc-cta" type="button" onClick={onConfirmar}>
                <span>
                  {cantidad === 0
                    ? "Quitar del pedido"
                    : enCarrito
                      ? "Actualizar pedido"
                      : "Agregar al pedido"}
                </span>
                {cantidad > 0 && <span>{dinero(Number(producto.precio) * cantidad)}</span>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HojaCarrito({
  carrito,
  total,
  mesa,
  setMesa,
  mesaFija,
  enviando,
  error,
  onCerrar,
  onSumar,
  onRestar,
  onNota,
  onEnviar,
}) {
  return (
    <div className="mc-overlay" onClick={onCerrar}>
      <div
        className="mc-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Tu pedido"
      >
        <div className="mc-sheet-head">
          <h2 className="mc-serif">Tu pedido</h2>
          <button className="mc-close flat" type="button" onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="close" size={18} />
          </button>
        </div>

        <div className="mc-sheet-body">
          {carrito.map((i) => (
            <div className="mc-item" key={i.id}>
              {i.imagenUrl ? (
                <img className="mc-item-img" src={i.imagenUrl} alt={i.nombre} />
              ) : (
                <div className="mc-item-img ph mc-serif">
                  {(i.nombre || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="mc-item-main">
                <div className="mc-item-row">
                  <span className="mc-item-name mc-serif">{i.nombre}</span>
                  <span className="mc-price mc-serif sm">
                    {dinero(Number(i.precio) * i.cantidad)}
                  </span>
                </div>
                <input
                  className="mc-note"
                  value={i.nota || ""}
                  onChange={(e) => onNota(i.id, e.target.value)}
                  placeholder="Aclaración (opcional)"
                />
                <Stepper
                  cantidad={i.cantidad}
                  onSumar={() => onSumar(i)}
                  onRestar={() => onRestar(i)}
                />
              </div>
            </div>
          ))}

          {!mesaFija && (
            <label className="mc-field">
              <span>Número de mesa</span>
              <input
                type="text"
                value={mesa}
                onChange={(e) => setMesa(e.target.value)}
                placeholder="Ej: 5"
              />
            </label>
          )}
        </div>

        <div className="mc-sheet-foot col">
          {error && <div className="mc-error">{error}</div>}
          <div className="mc-total">
            <span>Total</span>
            <b className="mc-serif">{dinero(total)}</b>
          </div>
          <button className="mc-cta full" type="button" onClick={onEnviar} disabled={enviando}>
            <span>{enviando ? "Enviando…" : "Enviar pedido"}</span>
          </button>
          <p className="mc-hint">Un mozo confirmará tu pedido en instantes.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────

const CSS = `
.mc{min-height:100vh;background:var(--bg);color:var(--texto);font-family:var(--sans);-webkit-font-smoothing:antialiased;line-height:1.4}
.mc *,.mc *::before,.mc *::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.mc button{font-family:inherit;cursor:pointer;color:inherit}
.mc h1,.mc h2,.mc h3,.mc p{margin:0}
.mc button:focus-visible,.mc input:focus-visible,.mc textarea:focus-visible{outline:2px solid var(--prim);outline-offset:2px}
.mc-serif{font-family:var(--fuente)}
.mc-wrap{max-width:980px;margin:0 auto}
.mc-center{display:flex;align-items:center;justify-content:center;padding:24px}

.mc-hero{position:relative;height:210px;overflow:hidden;background:var(--hero-grad)}
.mc-hero img{width:100%;height:100%;object-fit:cover;display:block}
.mc-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.08) 0%,rgba(0,0,0,.45) 100%)}
.mc-head{position:relative;z-index:2;margin:-44px 16px 0;padding:46px 18px 18px;background:var(--card);border:1px solid var(--borde);border-radius:24px;box-shadow:var(--sombra)}
.mc-logo{position:absolute;top:-30px;left:18px;width:64px;height:64px;border-radius:20px;object-fit:cover;border:3px solid var(--card);background:var(--card);box-shadow:0 6px 18px rgba(0,0,0,.25)}
.mc-mono{display:flex;align-items:center;justify-content:center;background:var(--prim);color:var(--sobre-prim);font-family:var(--fuente);font-size:28px;font-weight:800}
.mc-head h1{font-size:clamp(26px,6vw,34px);font-weight:800;line-height:1.1;letter-spacing:-.01em}
.mc-sub{margin-top:6px;font-size:14px;font-weight:600;color:var(--prim)}
.mc-welcome{margin-top:10px;font-size:14px;color:var(--suave);line-height:1.5}
.mc-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.mc-pill{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--borde);color:var(--suave)}
.mc-pill.on{background:var(--prim-suave);border-color:var(--borde-prim);color:var(--prim)}

.mc-sticky{position:sticky;top:0;z-index:40;margin-top:14px;background:var(--vidrio);-webkit-backdrop-filter:saturate(180%) blur(16px);backdrop-filter:saturate(180%) blur(16px);border-bottom:1px solid var(--borde)}
.mc-search{display:flex;align-items:center;gap:10px;margin:10px 16px 4px;height:46px;padding:0 14px;border-radius:14px;background:var(--card);border:1px solid var(--borde);color:var(--tenue);transition:border-color .2s,color .2s}
.mc-search:last-child{margin-bottom:10px}
.mc-search:focus-within{border-color:var(--borde-prim);color:var(--prim)}
.mc-search input{flex:1;min-width:0;height:100%;background:transparent;border:0;outline:0;color:var(--texto);font:inherit;font-size:15px}
.mc-search input::placeholder{color:var(--tenue)}
.mc-clear{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;border-radius:50%;background:var(--borde);color:var(--suave)}
.mc-chips{position:relative;display:flex;gap:8px;overflow-x:auto;padding:8px 16px 12px;scrollbar-width:none}
.mc-chips::-webkit-scrollbar{display:none}
.mc-chip{flex:none;padding:8px 16px;border-radius:999px;border:1px solid var(--borde);background:transparent;color:var(--suave);font-size:14px;font-weight:600;white-space:nowrap;transition:background .2s,color .2s,border-color .2s}
.mc-chip.on{background:var(--prim);border-color:var(--prim);color:var(--sobre-prim)}

.mc-main{padding-bottom:120px}
.mc-sec{padding:26px 16px 0;scroll-margin-top:128px}
.mc-sec-title{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
.mc-sec-title h2{font-size:24px;font-weight:700;letter-spacing:-.01em}
.mc-sec-title span{font-size:13px;color:var(--tenue)}
.mc-list{display:grid;grid-template-columns:1fr;column-gap:40px}
@media(min-width:760px){.mc-list{grid-template-columns:1fr 1fr}}

.mc-prod{display:flex;gap:16px;padding:16px 0;border-bottom:1px solid var(--borde);cursor:pointer;transition:opacity .15s}
.mc-prod:active{opacity:.7}
.mc-prod:hover .mc-prod-name{color:var(--prim)}
.mc-prod.off{opacity:.55}
.mc-prod-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.mc-prod-name{font-size:17px;font-weight:700;line-height:1.25;transition:color .2s}
.mc-prod-desc{font-size:14px;color:var(--suave);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mc-prod-foot{margin-top:auto;padding-top:4px;display:flex;align-items:center;gap:12px}
.mc-price{font-size:17px;font-weight:800;color:var(--prim)}
.mc-price.big{font-size:22px}
.mc-price.sm{font-size:15px}
.mc-meta{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--tenue)}
.mc-meta.big{font-size:13px;color:var(--suave)}

.mc-prod-img{position:relative;flex:none;width:112px;height:112px;border-radius:18px;overflow:hidden;background:var(--prim-suave);display:flex;align-items:center;justify-content:center}
.mc-prod-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mc-prod-ini{font-size:38px;font-weight:800;color:var(--prim);opacity:.55}
.mc-add{position:absolute;right:8px;bottom:8px;width:36px;height:36px;border:0;border-radius:50%;background:var(--prim);color:var(--sobre-prim);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.35);transition:transform .15s}
.mc-add:active{transform:scale(.9)}
.mc-off-badge{position:absolute;left:8px;bottom:8px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.72);color:#fff;font-size:12px;font-weight:600}

.mc-step{display:inline-flex;align-items:center;background:var(--card);border:1px solid var(--borde);border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.mc-step button{width:34px;height:34px;border:0;background:transparent;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--prim)}
.mc-step button:active{background:var(--prim-suave)}
.mc-step b{min-width:20px;text-align:center;font-size:15px;color:var(--texto)}
.mc-prod-img .mc-step{position:absolute;right:6px;bottom:6px}

.mc-skel{height:120px;margin-top:14px;border-radius:18px;background:linear-gradient(90deg,var(--card) 25%,var(--borde) 50%,var(--card) 75%);background-size:200% 100%;animation:mc-shimmer 1.4s infinite}
@keyframes mc-shimmer{to{background-position:-200% 0}}
.mc-empty{padding:56px 16px;text-align:center;color:var(--suave);font-size:15px;display:flex;flex-direction:column;align-items:center;gap:14px}
.mc-empty button{padding:10px 18px;border-radius:12px;border:1px solid var(--borde-prim);background:transparent;color:var(--prim);font-size:14px;font-weight:600}

.mc-bar{position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));margin:0 auto;max-width:520px;z-index:60;height:58px;border:0;border-radius:18px;background:var(--prim);color:var(--sobre-prim);display:flex;align-items:center;gap:12px;padding:0 16px;box-shadow:0 14px 34px rgba(0,0,0,.4);transition:transform .15s}
.mc-bar:active{transform:scale(.98)}
.mc-bar-count{min-width:30px;height:30px;padding:0 8px;border-radius:999px;background:var(--sobre-prim);color:var(--prim);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}
.mc-bar-label{flex:1;text-align:left;font-size:16px;font-weight:700}
.mc-bar-total{font-size:17px;font-weight:800}

.mc-overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.58);display:flex;align-items:flex-end;justify-content:center;animation:mc-fade .2s both}
.mc-sheet{width:100%;max-width:560px;max-height:92vh;background:var(--bg);border:1px solid var(--borde);border-bottom:0;border-radius:28px 28px 0 0;overflow:hidden;display:flex;flex-direction:column;animation:mc-up .32s cubic-bezier(.2,.8,.2,1) both}
@media(min-width:760px){.mc-overlay{align-items:center}.mc-sheet{border-bottom:1px solid var(--borde);border-radius:28px}}
@keyframes mc-fade{from{opacity:0}to{opacity:1}}
@keyframes mc-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.mc-sheet-img{position:relative;flex:none;height:260px;background:var(--prim-suave)}
.mc-sheet-img img{width:100%;height:100%;object-fit:cover;display:block}
.mc-sheet-ph{height:100%;display:flex;align-items:center;justify-content:center;font-size:84px;font-weight:800;color:var(--prim);opacity:.5}
.mc-close{position:absolute;top:14px;right:14px;width:38px;height:38px;border:0;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.mc-close.flat{position:static;background:var(--card);color:var(--suave);border:1px solid var(--borde)}
.mc-sheet-head{flex:none;display:flex;align-items:center;justify-content:space-between;padding:20px 20px 4px}
.mc-sheet-head h2{font-size:22px;font-weight:700}
.mc-sheet-body{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}
.mc-sheet-top{display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.mc-sheet-top h2{font-size:24px;font-weight:800;line-height:1.15}
.mc-sheet-desc{font-size:15px;color:var(--suave);line-height:1.65}
.mc-field{display:flex;flex-direction:column;gap:8px}
.mc-field span{font-size:13px;font-weight:600;color:var(--suave)}
.mc-field textarea,.mc-field input{width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--borde);background:var(--card);color:var(--texto);font:inherit;font-size:15px;resize:none}
.mc-field textarea::placeholder,.mc-field input::placeholder{color:var(--tenue)}
.mc-sheet-foot{flex:none;display:flex;align-items:center;gap:12px;padding:14px 20px calc(16px + env(safe-area-inset-bottom));border-top:1px solid var(--borde);background:var(--bg)}
.mc-sheet-foot.col{flex-direction:column;align-items:stretch;gap:10px}
.mc-qty{display:inline-flex;align-items:center;height:52px;border:1px solid var(--borde);border-radius:16px;background:var(--card)}
.mc-qty button{width:46px;height:100%;border:0;background:transparent;display:flex;align-items:center;justify-content:center;color:var(--prim)}
.mc-qty button:disabled{opacity:.3;cursor:default}
.mc-qty b{min-width:26px;text-align:center;font-size:17px}
.mc-cta{flex:1;height:52px;padding:0 18px;border:0;border-radius:16px;background:var(--prim);color:var(--sobre-prim);font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:12px;transition:transform .15s,opacity .2s}
.mc-cta:active{transform:scale(.98)}
.mc-cta:disabled{opacity:.6;cursor:default}
.mc-cta.full{width:100%;flex:none;justify-content:center}
.mc-cta.off{background:var(--borde);color:var(--suave);justify-content:center}

.mc-item{display:flex;gap:12px;padding:12px;border-radius:18px;background:var(--card);border:1px solid var(--borde)}
.mc-item-img{flex:none;width:60px;height:60px;border-radius:14px;object-fit:cover;background:var(--prim-suave)}
.mc-item-img.ph{display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:var(--prim)}
.mc-item-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.mc-item-row{width:100%;display:flex;justify-content:space-between;gap:12px}
.mc-item-name{font-size:15px;font-weight:700;line-height:1.25}
.mc-note{width:100%;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--borde);background:var(--bg);color:var(--texto);font:inherit;font-size:13px}
.mc-note::placeholder{color:var(--tenue)}
.mc-total{display:flex;align-items:baseline;justify-content:space-between;font-size:15px;color:var(--suave)}
.mc-total b{font-size:26px;font-weight:800;color:var(--texto)}
.mc-error{padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--error) 14%,transparent);border:1px solid var(--error);color:var(--texto);font-size:14px}
.mc-hint{text-align:center;font-size:13px;color:var(--tenue)}

.mc-track{width:100%;max-width:440px;padding:36px 24px 28px;background:var(--card);border:1px solid var(--borde);border-radius:28px;box-shadow:var(--sombra);text-align:center}
.mc-track-ring{width:84px;height:84px;margin:0 auto 20px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--c);border:2px solid var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.mc-track-ring.pulse{animation:mc-ring 1.8s ease-out infinite}
@keyframes mc-ring{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 40%,transparent)}100%{box-shadow:0 0 0 18px transparent}}
.mc-track-num{font-size:14px;font-weight:600;color:var(--suave)}
.mc-track h1{margin-top:6px;font-size:26px;font-weight:800;line-height:1.15}
.mc-track-text{margin-top:8px;font-size:15px;color:var(--suave);line-height:1.5}
.mc-steps{position:relative;display:grid;grid-template-columns:repeat(4,1fr);margin:30px 0 26px}
.mc-steps-line{position:absolute;left:12.5%;right:12.5%;top:17px;height:2px;background:var(--borde)}
.mc-steps-fill{position:absolute;left:12.5%;top:17px;height:2px;background:var(--prim);transition:width .6s ease}
.mc-step-i{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:8px;font-size:12px;color:var(--tenue)}
.mc-dot{width:36px;height:36px;border-radius:50%;background:var(--card);border:2px solid var(--borde);display:flex;align-items:center;justify-content:center;transition:all .4s ease}
.mc-step-i.done .mc-dot,.mc-step-i.now .mc-dot{background:var(--prim);border-color:var(--prim);color:var(--sobre-prim)}
.mc-step-i.now .mc-dot{box-shadow:0 0 0 5px var(--prim-suave)}
.mc-step-i.done,.mc-step-i.now{color:var(--texto);font-weight:600}
.mc-resumen{margin:0 0 20px;padding:14px 16px;border:1px solid var(--borde);border-radius:16px;text-align:left}
.mc-resumen-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:14px}
.mc-resumen-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:12px;border-top:1px solid var(--borde);font-size:15px;color:var(--suave)}
.mc-resumen-total b{font-size:20px;color:var(--prim)}

@media (prefers-reduced-motion:reduce){.mc *,.mc *::before,.mc *::after{animation:none!important;transition:none!important}}
`;

function Estilos() {
  return <style>{CSS}</style>;
}