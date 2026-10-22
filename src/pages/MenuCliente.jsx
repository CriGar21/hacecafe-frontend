import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { leerConfig, derivarColores, getFuente } from "../utils/menuConfig";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const PASOS = [
  { estado: "ESPERANDO_APROBACION", label: "Enviado" },
  { estado: "PENDIENTE",            label: "Confirmado" },
  { estado: "EN_PREPARACION",       label: "Preparando" },
  { estado: "LISTO",                label: "¡Listo!" },
];

function normalizarEstado(e) {
  return e === "APROBADO" ? "PENDIENTE" : e;
}

export default function MenuCliente() {
  const [searchParams] = useSearchParams();
  const mesaDesdeQR = searchParams.get("mesa") || "";

  // ── Config de apariencia (se lee de localStorage) ──
  const [cfg, setCfg] = useState(leerConfig);

  // Carga el visor 3D una sola vez. No requiere instalar paquetes adicionales.
  useEffect(() => {
    if (document.querySelector('script[data-hacecafe-model-viewer="true"]')) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    script.dataset.hacecafeModelViewer = "true";
    document.head.appendChild(script);
  }, []);

  // Relee la config si cambia en otra pestaña
  useEffect(() => {
    const onStorage = () => setCfg(leerConfig());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const C   = buildColors(cfg);
  const fuente = getFuente(cfg.fuenteId);
  const sans   = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  const ESTADOS_CLIENTE = {
    ESPERANDO_APROBACION: { emoji: "⏳", titulo: "Esperando confirmación",  texto: "El local está revisando tu pedido...",                    color: C.gold, pasoActual: 0 },
    PENDIENTE:            { emoji: "✓",  titulo: "¡Pedido confirmado!",      texto: "Tu pedido fue aceptado y pronto empiezan a prepararlo.", color: "#4a8a4a", pasoActual: 1 },
    EN_PREPARACION:       { emoji: "👨‍🍳", titulo: "En preparación",          texto: "¡Cocina está trabajando en tu pedido!",                 color: "#4A8BCC", pasoActual: 2 },
    LISTO:                { emoji: "🔔", titulo: "¡Tu pedido está listo!",   texto: "Pasá a retirar o el mozo te lo lleva en un momento.",   color: "#4a8a4a", pasoActual: 3 },
    RECHAZADO:            { emoji: "✕",  titulo: "Pedido no procesado",      texto: "El pedido no pudo procesarse. Hablá con el mozo.",      color: "#8B2020", pasoActual: -1 },
    ENTREGADO:            { emoji: "✓",  titulo: "¡Pedido entregado!",       texto: "Que lo disfrutes. ¡Gracias por tu visita!",            color: "#4a8a4a", pasoActual: 4 },
  };

  // ── Estado del menú ──
  const [categorias, setCategorias]     = useState([]);
  const [productos, setProductos]       = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [carrito, setCarrito]           = useState([]);
  const [verCarrito, setVerCarrito]     = useState(false);
  const [mesa, setMesa]                 = useState(mesaDesdeQR);
  const [enviando, setEnviando]         = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(null);
  const [productoDetalle, setProductoDetalle] = useState(null);
  const [visorProducto, setVisorProducto] = useState(null);
  const [modoVisor, setModoVisor] = useState("3d");
  const [visorError, setVisorError] = useState("");
  const visorRef = useRef(null);
  const [notaDetalle, setNotaDetalle]   = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloDestacados, setSoloDestacados] = useState(false);
  const [favoritos, setFavoritos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hacecafe_favoritos") || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("hacecafe_favoritos", JSON.stringify(favoritos));
  }, [favoritos]);

  const alternarFavorito = id => {
    setFavoritos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  useEffect(() => {
    fetch(`${API}/categorias`).then(r => r.json()).then(data => {
      setCategorias(data);
      if (data.length > 0) setCategoriaActiva(data[0].id);
    });
    fetch(`${API}/productos`).then(r => r.json()).then(setProductos);
  }, []);

  const productosFiltrados = productos.filter(p => {
    const disponible = p.disponible !== false;
    const coincideCategoria = p.categoriaId === categoriaActiva;
    const texto = `${p.nombre || ""} ${p.descripcion || ""} ${p.categoria?.nombre || ""}`.toLowerCase();
    const coincideBusqueda = texto.includes(busqueda.trim().toLowerCase());
    const destacado = p.destacado === true || p.esDestacado === true || p.popular === true;
    return disponible && coincideCategoria && coincideBusqueda && (!soloDestacados || destacado);
  });

  const productosDestacados = productos.filter(p =>
    p.disponible !== false && (p.destacado === true || p.esDestacado === true || p.popular === true)
  ).slice(0, 8);

  const agregarAlCarrito = (producto, nota = "") => {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === producto.id);
      if (existe) return prev.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { ...producto, cantidad: 1, nota }];
    });
  };

  const quitarDelCarrito = (productoId) => {
    setCarrito(prev => {
      const item = prev.find(i => i.id === productoId);
      if (item.cantidad === 1) return prev.filter(i => i.id !== productoId);
      return prev.map(i => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  };

  const actualizarNota = (productoId, nota) =>
    setCarrito(prev => prev.map(i => i.id === productoId ? { ...i, nota } : i));

  const enCarrito    = id => carrito.find(i => i.id === id);
  const totalCarrito = carrito.reduce((acc, i) => acc + Number(i.precio) * i.cantidad, 0);
  const cantidadTotal = carrito.reduce((acc, i) => acc + i.cantidad, 0);

  const abrirDetalle = producto => {
    setProductoDetalle(producto);
    setNotaDetalle(enCarrito(producto.id)?.nota || "");
    document.body.style.overflow = "hidden";
  };

  const cerrarDetalle = () => {
    setProductoDetalle(null);
    setNotaDetalle("");
    document.body.style.overflow = "";
  };

  const confirmarDetalle = () => {
    const item = enCarrito(productoDetalle.id);
    if (!item) agregarAlCarrito(productoDetalle, notaDetalle);
    else actualizarNota(productoDetalle.id, notaDetalle);
    cerrarDetalle();
  };

  const abrirVisor = (producto, modo = "3d") => {
    setVisorError("");
    setModoVisor(modo);
    setVisorProducto(producto);
  };

  const cerrarVisor = () => {
    setVisorProducto(null);
    setVisorError("");
  };

  const obtenerModelo3D = producto => producto?.modelo3DUrl || producto?.modelo3dUrl || producto?.modeloUrl || producto?.modelUrl || producto?.modeloGLBUrl || "";
  const obtenerModeloUSDZ = producto => producto?.modeloUSDZUrl || producto?.usdzUrl || producto?.modelUsdzUrl || "";

  const activarAR = async () => {
    setVisorError("");
    const visor = visorRef.current;
    if (!visor) {
      setVisorError("El visor 3D todavía se está cargando. Probá nuevamente en unos segundos.");
      return;
    }
    if (typeof visor.activateAR !== "function") {
      setVisorError("Este navegador no tiene disponible la función de realidad aumentada. Probá desde Safari en iPhone o Chrome en Android.");
      return;
    }
    try { await visor.activateAR(); }
    catch { setVisorError("No se pudo iniciar la cámara. Verificá el permiso de cámara y abrí HaceCafe desde HTTPS."); }
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
          items: carrito.map(i => ({ productoId: i.id, cantidad: i.cantidad, notas: i.nota })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);

      setPedidoEnviado({ ...data, estadoSeguimiento: "ESPERANDO_APROBACION" });
      setCarrito([]);
      setVerCarrito(false);
      document.body.style.overflow = "";

      const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3001", { transports: ["websocket"] });
      socket.on("pedido_aprobado", p => { if (p.id === data.id) setPedidoEnviado(prev => ({ ...prev, estadoSeguimiento: "PENDIENTE" })); });
      socket.on("pedido_rechazado", ({ pedidoId }) => { if (pedidoId === data.id) { setPedidoEnviado(prev => ({ ...prev, estadoSeguimiento: "RECHAZADO" })); socket.disconnect(); } });
      socket.on("pedido_actualizado", pedido => {
        if (pedido.id === data.id) {
          setPedidoEnviado(prev => ({ ...prev, estadoSeguimiento: normalizarEstado(pedido.estado) }));
          if (["ENTREGADO","COBRADO","CANCELADO"].includes(pedido.estado)) socket.disconnect();
        }
      });
      setTimeout(() => socket.disconnect(), 30 * 60 * 1000);
    } catch (error) {
      alert(error.message || "Error al enviar el pedido");
    } finally {
      setEnviando(false);
    }
  };

  // ── Pantalla de seguimiento ──────────────────────────────────
  if (pedidoEnviado) {
    const estado = pedidoEnviado.estadoSeguimiento || "ESPERANDO_APROBACION";
    const info = ESTADOS_CLIENTE[estado] || ESTADOS_CLIENTE["ESPERANDO_APROBACION"];
    const pasoActual = info.pasoActual;
    const esRechazado = estado === "RECHAZADO";
    const esTerminado = ["ENTREGADO","COBRADO"].includes(estado);

    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem", fontFamily:sans }}>
        <div style={{ background:C.card, borderRadius:"24px", padding:"2.5rem 2rem", maxWidth:"420px", width:"100%", textAlign:"center", border:`1px solid ${C.border}` }}>
          <div style={{ width:"72px", height:"72px", borderRadius:"50%", background:`${info.color}15`, border:`2px solid ${info.color}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1.2rem", fontSize:"2rem" }}>{info.emoji}</div>
          <h2 style={{ color:C.gold, fontFamily:fuente, fontWeight:"700", fontSize:"1.4rem", margin:"0 0 6px" }}>Pedido #{pedidoEnviado.numero}</h2>
          <p style={{ color:info.color, margin:"0 0 4px", fontSize:"16px", fontWeight:"700" }}>{info.titulo}</p>
          <p style={{ color:`${C.text}80`, margin:"0 0 1.5rem", fontSize:"13px" }}>{info.texto}</p>

          {estado === "ESPERANDO_APROBACION" && (
            <div style={{ display:"flex", justifyContent:"center", gap:"6px", marginBottom:"1.5rem" }}>
              {[0,1,2].map(i => <div key={i} style={{ width:"8px", height:"8px", borderRadius:"50%", background:C.gold, animation:`pulse 1.2s ease-in-out ${i*0.4}s infinite` }} />)}
            </div>
          )}

          {!esRechazado && (
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"relative", padding:"0 8px" }}>
                <div style={{ position:"absolute", top:"14px", left:"calc(12.5% + 6px)", right:"calc(12.5% + 6px)", height:"2px", background:C.border, zIndex:0 }} />
                <div style={{ position:"absolute", top:"14px", left:"calc(12.5% + 6px)", height:"2px", background:C.gold, zIndex:1, width: pasoActual===0?"0%":pasoActual===1?"33%":pasoActual===2?"66%":"75%", transition:"width 0.6s ease" }} />
                {PASOS.map((paso, idx) => {
                  const completado = idx < pasoActual;
                  const activo = idx === pasoActual;
                  return (
                    <div key={paso.estado} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", zIndex:2, flex:1 }}>
                      <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:completado||activo?C.gold:C.card, border:`2px solid ${completado||activo?C.gold:C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", color:completado||activo?C.bg:C.textSub, fontWeight:"800", transition:"all 0.4s ease", boxShadow:activo?`0 0 0 4px ${C.goldFaded}`:"none" }}>{completado?"✓":idx+1}</div>
                      <span style={{ fontSize:"10px", color:completado||activo?C.gold:C.textSub, fontWeight:activo?"700":"400", textAlign:"center" }}>{paso.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ border:`1px solid ${C.border}`, borderRadius:"12px", padding:"1rem", marginBottom:"1.5rem", textAlign:"left" }}>
            {pedidoEnviado.items?.map(item => (
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", fontSize:"14px", padding:"5px 0", borderBottom:`1px solid ${C.border}`, color:C.text }}>
                <span>{item.cantidad}x {item.producto?.nombre}</span>
                <span style={{ color:C.gold, fontWeight:"600" }}>${Number(item.subtotal).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:"800", fontSize:"16px", marginTop:"10px", color:C.gold, fontFamily:fuente }}>
              <span>Total</span><span>${Number(pedidoEnviado.total).toLocaleString()}</span>
            </div>
          </div>

          {(esRechazado||esTerminado) && (
            <button style={{ background:C.gold, color:C.bg, border:"none", borderRadius:"12px", padding:"14px", width:"100%", fontWeight:"800", fontSize:"15px", cursor:"pointer", fontFamily:fuente }} onClick={() => setPedidoEnviado(null)}>
              {esRechazado?"Volver al menú":"Hacer otro pedido"}
            </button>
          )}
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
      </div>
    );
  }

  // ── Menú principal ───────────────────────────────────────────
  const catActiva = categorias.find(c => c.id === categoriaActiva);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:sans }}>

      {/* HERO */}
      <div style={{ position:"relative", height:"270px", overflow:"hidden", display:"flex", alignItems:"flex-end" }}>
        {/* Fondo: imagen si hay, sino gradiente */}
        {cfg.heroBgUrl ? (
          <img src={cfg.heroBgUrl} alt="fondo" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
        ) : (
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 30% 50%, ${lighten(C.bg, 0.15)} 0%, ${C.bg} 65%)` }} />
        )}
        {/* Overlay siempre oscuro para legibilidad */}
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(to top, ${C.bg} 0%, ${hexToRgba(C.bg,0.6)} 50%, ${hexToRgba(C.bg,0.2)} 100%)` }} />

        {/* Contenido */}
        <div style={{ position:"relative", zIndex:2, padding:"0 1.5rem 2rem", width:"100%" }}>
          {/* Logo */}
          {cfg.logoUrl && (
            <img src={cfg.logoUrl} alt="logo" style={{ height:"48px", marginBottom:"10px", objectFit:"contain", display:"block" }} />
          )}
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
            <div style={{ width:"28px", height:"1px", background:C.gold, opacity:0.7 }} />
            <span style={{ fontSize:"9px", color:C.gold, letterSpacing:"5px", textTransform:"uppercase", fontWeight:"600", opacity:0.8 }}>Carta</span>
          </div>
          <h1 style={{ fontFamily:fuente, fontSize:"clamp(2rem, 8vw, 3.2rem)", fontWeight:"700", color:C.text, margin:"0 0 4px", lineHeight:1.05 }}>{cfg.nombre}</h1>
          {cfg.subtitulo && <p style={{ fontFamily:fuente, color:C.gold, fontSize:"11px", letterSpacing:"4px", margin:"0 0 8px", textTransform:"uppercase", opacity:0.75 }}>{cfg.subtitulo}</p>}
          {cfg.bienvenida && <p style={{ fontSize:"13px", color:`${C.text}80`, margin:"0 0 12px", lineHeight:1.5 }}>{cfg.bienvenida}</p>}
          <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
            <span style={{ display:"flex", alignItems:"center", gap:"5px", fontSize:"12px", color:C.textSub }}>
              <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#4a8a4a", display:"inline-block" }} /> Abierto
            </span>
            {mesa && <span style={{ border:`1px solid ${C.gold}`, color:C.gold, borderRadius:"20px", padding:"3px 14px", fontSize:"11px", fontWeight:"700", letterSpacing:"2px" }}>MESA {mesa}</span>}
          </div>
        </div>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"1px", background:`linear-gradient(to right, transparent, ${C.gold}30, transparent)` }} />
      </div>

      {/* BUSCADOR PREMIUM */}
      <div style={{ padding:"18px 1rem 12px", background:C.bg }}>
        <div style={{ maxWidth:"760px", margin:"0 auto", display:"flex", gap:"10px", alignItems:"center" }}>
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:"10px", padding:"13px 16px", borderRadius:"16px", border:`1px solid ${C.border}`, background:C.card }}>
            <span style={{ fontSize:"18px" }}>⌕</span>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="¿Qué se te antoja hoy?"
              aria-label="Buscar productos"
              style={{ width:"100%", border:"none", outline:"none", background:"transparent", color:C.text, fontSize:"14px", fontFamily:sans }} />
            {busqueda && <button onClick={() => setBusqueda("")} style={{ border:0, background:"transparent", color:C.textSub, cursor:"pointer", fontSize:"18px" }}>×</button>}
          </div>
          <button onClick={() => setSoloDestacados(v => !v)} style={{ padding:"13px 14px", borderRadius:"14px", border:`1px solid ${soloDestacados?C.gold:C.border}`, background:soloDestacados?C.goldFaded:C.card, color:soloDestacados?C.gold:C.text, cursor:"pointer", fontWeight:700, whiteSpace:"nowrap" }}>
            ★ Destacados
          </button>
        </div>
      </div>

      {/* DESTACADOS */}
      {!busqueda && !soloDestacados && productosDestacados.length > 0 && (
        <section style={{ padding:"10px 1rem 18px" }}>
          <div style={{ display:"flex", alignItems:"end", justifyContent:"space-between", gap:"12px", marginBottom:"12px" }}>
            <div>
              <p style={{ color:C.gold, fontSize:"10px", letterSpacing:"3px", textTransform:"uppercase", margin:"0 0 5px", fontWeight:800 }}>PARA DISFRUTAR</p>
              <h2 style={{ color:C.text, fontSize:"22px", fontFamily:fuente, margin:0 }}>Los favoritos de la casa</h2>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(145px, 1fr))", gap:"10px" }}>
            {productosDestacados.map(p => (
              <button key={p.id} onClick={() => abrirDetalle(p)} style={{ textAlign:"left", padding:0, overflow:"hidden", borderRadius:"16px", border:`1px solid ${C.border}`, background:C.card, color:C.text, cursor:"pointer" }}>
                <div style={{ height:"112px", overflow:"hidden", background:C.bg }}>
                  {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <div style={{ height:"100%", display:"grid", placeItems:"center", fontSize:"35px" }}>{p.categoria?.icono || "☕"}</div>}
                </div>
                <div style={{ padding:"11px" }}>
                  <div style={{ fontSize:"13px", fontWeight:800, marginBottom:"5px" }}>{p.nombre}</div>
                  <div style={{ color:C.gold, fontWeight:800 }}>${Number(p.precio).toLocaleString()}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* CATEGORÍAS sticky */}
      <div style={{ position:"sticky", top:0, zIndex:50, background:`${C.bg}ee`, backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ overflowX:"auto", padding:"0 1rem", scrollbarWidth:"none" }}>
          <div style={{ display:"flex", gap:"4px", padding:"10px 0", minWidth:"max-content" }}>
            {categorias.map(cat => (
              <button key={cat.id} onClick={() => setCategoriaActiva(cat.id)}
                style={{ padding:"7px 16px", borderRadius:"30px", cursor:"pointer", fontSize:"13px", fontWeight:"600", border:"none", background:categoriaActiva===cat.id?C.gold:"transparent", color:categoriaActiva===cat.id?C.bg:C.textSub, transition:"all 0.2s", whiteSpace:"nowrap", fontFamily:sans }}>
                {cat.icono && <span style={{ marginRight:"4px" }}>{cat.icono}</span>}{cat.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SEPARADOR */}
      <div style={{ padding:"1.5rem 1.5rem 0.8rem", display:"flex", alignItems:"center", gap:"14px" }}>
        <div style={{ height:"1px", flex:1, background:`linear-gradient(to right, ${C.border}, transparent)` }} />
        <span style={{ color:C.gold, fontSize:"9px", fontWeight:"700", letterSpacing:"4px", textTransform:"uppercase", fontFamily:fuente, opacity:0.8 }}>
          {busqueda ? "Resultados de búsqueda" : soloDestacados ? "Productos destacados" : `${catActiva?.icono || ""} ${catActiva?.nombre || ""}`} 
        </span>
        <div style={{ height:"1px", flex:1, background:`linear-gradient(to left, ${C.border}, transparent)` }} />
      </div>

      {/* GRILLA */}
      <div style={{ padding:"0.5rem 1rem 120px", display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(155px, 1fr))", gap:"10px" }}>
        {productosFiltrados.map(producto => (
          <ProductoCard
            key={producto.id}
            producto={producto}
            item={enCarrito(producto.id)}
            C={C}
            fuente={fuente}
            onVerDetalle={() => abrirDetalle(producto)}
            onAgregar={() => agregarAlCarrito(producto)}
            onQuitar={() => quitarDelCarrito(producto.id)}
          />
        ))}
      </div>

      {/* MODAL DETALLE */}
      {productoDetalle && (
        <div style={{ position:"fixed", inset:0, background:C.overlay, zIndex:300, display:"flex", alignItems:"flex-end" }} onClick={cerrarDetalle}>
          <div style={{ background:C.bgModal, borderRadius:"24px 24px 0 0", width:"100%", maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column", border:`1px solid ${C.border}`, borderBottom:"none" }} onClick={e => e.stopPropagation()}>
            {/* Imagen */}
            <div style={{ position:"relative", width:"100%", height:"240px", flexShrink:0 }}>
              {productoDetalle.imagenUrl ? (
                <img src={productoDetalle.imagenUrl} alt={productoDetalle.nombre} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : (
                <div style={{ width:"100%", height:"100%", background:`radial-gradient(ellipse at center, ${lighten(C.bg,0.15)} 0%, ${C.bg} 100%)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:"5rem", opacity:0.25 }}>{productoDetalle.categoria?.icono || "🍽️"}</span>
                </div>
              )}
              <div style={{ position:"absolute", inset:0, background:`linear-gradient(to top, ${C.bgModal} 0%, ${hexToRgba(C.bgModal,0.2)} 60%, transparent 100%)` }} />
              <button style={{ position:"absolute", top:"14px", right:"14px", background:"rgba(0,0,0,0.55)", border:`1px solid ${C.border}`, borderRadius:"50%", width:"36px", height:"36px", color:C.text, fontSize:"15px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }} onClick={cerrarDetalle}>✕</button>
              <div style={{ position:"absolute", bottom:"10px", left:"50%", transform:"translateX(-50%)", width:"36px", height:"3px", borderRadius:"2px", background:"rgba(255,255,255,0.25)" }} />
            </div>

            {/* Contenido */}
            <div style={{ overflowY:"auto", padding:"1.2rem 1.5rem 1.8rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
                  <h2 style={{ fontFamily:fuente, fontSize:"1.5rem", fontWeight:"700", color:C.text, margin:0, lineHeight:1.2 }}>{productoDetalle.nombre}</h2>
                  <span style={{ fontFamily:fuente, fontSize:"1.3rem", fontWeight:"900", color:C.gold, flexShrink:0 }}>${Number(productoDetalle.precio).toLocaleString()}</span>
                </div>
                {productoDetalle.descripcion && <p style={{ color:C.textSub, fontSize:"14px", lineHeight:1.75, margin:"10px 0 0" }}>{productoDetalle.descripcion}</p>}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"9px", marginTop:"16px" }}>
                  <button type="button" onClick={() => abrirVisor(productoDetalle, "3d")} style={{ border:`1px solid ${C.gold}`, background:C.goldFaded, color:C.gold, borderRadius:"12px", padding:"12px 8px", fontWeight:"800", fontSize:"12px", cursor:"pointer" }}>⟳ Ver en 3D</button>
                  <button type="button" onClick={() => abrirVisor(productoDetalle, "ar")} style={{ border:`1px solid ${C.borderHover}`, background:C.card, color:C.text, borderRadius:"12px", padding:"12px 8px", fontWeight:"800", fontSize:"12px", cursor:"pointer" }}>⌖ Ver en mi mesa</button>
                </div>
              </div>

              {productoDetalle.tiempoPreparacion && (
                <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px", background:C.goldFaded, borderRadius:"10px", border:`1px solid ${C.border}` }}>
                  <span>⏱️</span>
                  <span style={{ fontSize:"13px", color:C.text }}>Tiempo de preparación: <strong style={{ color:C.gold }}>{productoDetalle.tiempoPreparacion} min</strong></span>
                </div>
              )}

              <div>
                <label style={{ fontSize:"10px", fontWeight:"700", color:C.textSub, display:"block", marginBottom:"8px", letterSpacing:"2px", textTransform:"uppercase" }}>Aclaración especial</label>
                <input type="text" value={notaDetalle} onChange={e => setNotaDetalle(e.target.value)} placeholder="Sin azúcar, bien caliente, sin TACC..." style={{ width:"100%", padding:"12px 14px", borderRadius:"10px", background:C.card, border:`1px solid ${C.border}`, color:C.text, fontSize:"14px", boxSizing:"border-box", outline:"none", fontFamily:sans }} />
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                {enCarrito(productoDetalle.id) && (
                  <div style={{ display:"flex", alignItems:"center", gap:"12px", background:C.card, borderRadius:"12px", padding:"10px 16px", border:`1px solid ${C.border}` }}>
                    <button style={{ width:"28px", height:"28px", borderRadius:"50%", background:"transparent", border:`1px solid ${C.border}`, color:C.gold, fontSize:"16px", cursor:"pointer", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => quitarDelCarrito(productoDetalle.id)}>−</button>
                    <span style={{ fontWeight:"800", color:C.gold, fontSize:"16px", minWidth:"24px", textAlign:"center" }}>{enCarrito(productoDetalle.id)?.cantidad||0}</span>
                    <button style={{ width:"28px", height:"28px", borderRadius:"50%", background:C.gold, border:"none", color:C.bg, fontSize:"16px", cursor:"pointer", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => agregarAlCarrito(productoDetalle)}>+</button>
                  </div>
                )}
                <button style={{ flex:1, background:C.gold, color:C.bg, border:"none", borderRadius:"12px", padding:"15px", fontWeight:"800", fontSize:"15px", cursor:"pointer", fontFamily:fuente }} onClick={confirmarDetalle}>
                  {enCarrito(productoDetalle.id) ? "Guardar cambios" : `Agregar — $${Number(productoDetalle.precio).toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISOR 3D / REALIDAD AUMENTADA */}
      {visorProducto && (() => {
        const modelo = obtenerModelo3D(visorProducto);
        const usdz = obtenerModeloUSDZ(visorProducto);
        const imagen = visorProducto.imagenUrl || "";
        return (
          <div role="dialog" aria-modal="true" aria-label={`Visualización de ${visorProducto.nombre}`} style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(0,0,0,.82)", display:"flex", alignItems:"center", justifyContent:"center", padding:"14px", backdropFilter:"blur(12px)" }} onClick={cerrarVisor}>
            <div style={{ width:"100%", maxWidth:"560px", maxHeight:"94vh", overflowY:"auto", borderRadius:"24px", border:`1px solid ${C.border}`, background:C.bgModal, color:C.text, boxShadow:"0 24px 80px rgba(0,0,0,.45)" }} onClick={e => e.stopPropagation()}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", padding:"18px 18px 12px" }}>
                <div><div style={{ fontSize:"10px", textTransform:"uppercase", letterSpacing:"2px", color:C.gold, fontWeight:"800" }}>Experiencia interactiva</div><h2 style={{ margin:"5px 0 0", fontFamily:fuente, fontSize:"20px" }}>{visorProducto.nombre}</h2></div>
                <button type="button" aria-label="Cerrar visor" onClick={cerrarVisor} style={{ width:"36px", height:"36px", borderRadius:"50%", border:`1px solid ${C.border}`, background:C.card, color:C.text, cursor:"pointer", fontSize:"18px" }}>×</button>
              </div>
              <div style={{ display:"flex", gap:"8px", padding:"0 18px 14px" }}>
                <button type="button" onClick={() => { setModoVisor("3d"); setVisorError(""); }} style={{ flex:1, borderRadius:"10px", border:`1px solid ${modoVisor==="3d"?C.gold:C.border}`, background:modoVisor==="3d"?C.goldFaded:"transparent", color:modoVisor==="3d"?C.gold:C.textSub, padding:"10px", fontWeight:"800", cursor:"pointer" }}>⟳ Explorar 3D</button>
                <button type="button" onClick={() => { setModoVisor("ar"); setVisorError(""); }} style={{ flex:1, borderRadius:"10px", border:`1px solid ${modoVisor==="ar"?C.gold:C.border}`, background:modoVisor==="ar"?C.goldFaded:"transparent", color:modoVisor==="ar"?C.gold:C.textSub, padding:"10px", fontWeight:"800", cursor:"pointer" }}>⌖ Ver en mi mesa</button>
              </div>
              <div style={{ margin:"0 18px", borderRadius:"16px", overflow:"hidden", background:`radial-gradient(ellipse at center, ${lighten(C.bg,0.12)}, ${C.bg})`, minHeight:"300px", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                {modelo ? (
                  <model-viewer ref={visorRef} key={`${modelo}-${modoVisor}`} src={modelo} ios-src={usdz || undefined} poster={imagen || undefined} alt={`Modelo 3D de ${visorProducto.nombre}`} camera-controls auto-rotate shadow-intensity="1" exposure="1" ar ar-modes="webxr scene-viewer quick-look" style={{ width:"100%", height:"min(52vh, 440px)", minHeight:"300px", backgroundColor:"transparent", color:C.text }} loading="eager">
                    <button slot="ar-button" type="button" onClick={activarAR} style={{ position:"absolute", bottom:"16px", left:"50%", transform:"translateX(-50%)", border:0, borderRadius:"999px", background:C.gold, color:C.bg, padding:"12px 18px", fontWeight:"900", whiteSpace:"nowrap", cursor:"pointer" }}>⌖ Colocar en mi mesa</button>
                  </model-viewer>
                ) : (
                  <div style={{ padding:"28px 22px", textAlign:"center", maxWidth:"360px" }}>
                    {imagen ? <img src={imagen} alt={visorProducto.nombre} style={{ width:"150px", height:"150px", objectFit:"contain", borderRadius:"16px", marginBottom:"14px", filter:"drop-shadow(0 15px 22px rgba(0,0,0,.35))" }} /> : <div style={{ fontSize:"64px", marginBottom:"12px" }}>☕</div>}
                    <div style={{ fontWeight:"900", fontSize:"16px", marginBottom:"8px" }}>Todavía falta crear el modelo 3D</div>
                    <p style={{ color:C.textSub, fontSize:"13px", lineHeight:1.7, margin:0 }}>Esta es la foto del menú. Para girar la bebida o colocarla con la cámara necesitamos convertirla primero en un archivo 3D (GLB; y opcionalmente USDZ para iPhone).</p>
                  </div>
                )}
              </div>
              {visorError && <p role="alert" style={{ margin:"12px 18px 0", padding:"10px 12px", borderRadius:"10px", background:"rgba(190,70,50,.12)", color:"#f0a090", fontSize:"12px", lineHeight:1.5 }}>{visorError}</p>}
              <div style={{ padding:"14px 18px 18px" }}>
                {modelo ? (modoVisor === "ar" ? <button type="button" onClick={activarAR} style={{ width:"100%", border:0, borderRadius:"12px", background:C.gold, color:C.bg, padding:"14px", fontWeight:"900", cursor:"pointer" }}>⌖ Abrir cámara y colocar bebida</button> : <p style={{ margin:0, textAlign:"center", color:C.textSub, fontSize:"12px" }}>Arrastrá para girar y usá dos dedos para acercar o alejar.</p>) : <div style={{ padding:"12px", borderRadius:"12px", background:C.card, border:`1px solid ${C.border}`, color:C.textSub, fontSize:"12px", lineHeight:1.6 }}>La generación automática desde una foto requiere conectar un servicio de IA de imagen a 3D en el backend. Esta pantalla ya acepta el modelo cuando esté generado; todavía no se inventa un 3D falso ni se envía la foto a un proveedor externo.</div>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CARRITO FLOTANTE */}
      {carrito.length > 0 && !verCarrito && (
        <div style={{ position:"fixed", bottom:"20px", left:"50%", transform:"translateX(-50%)", background:C.gold, borderRadius:"50px", padding:"13px 20px", display:"flex", alignItems:"center", gap:"12px", boxShadow:`0 8px 40px ${hexToRgba(C.gold,0.35)}, 0 2px 8px rgba(0,0,0,0.5)`, width:"calc(100% - 3rem)", maxWidth:"420px", cursor:"pointer", zIndex:100 }}
          onClick={() => { setVerCarrito(true); document.body.style.overflow="hidden"; }}>
          <div style={{ background:C.bg, borderRadius:"50%", width:"30px", height:"30px", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"900", fontSize:"14px", color:C.gold, flexShrink:0 }}>{cantidadTotal}</div>
          <span style={{ flex:1, fontWeight:"700", fontSize:"14px", color:C.bg, fontFamily:fuente }}>Ver mi pedido</span>
          <span style={{ fontWeight:"900", fontSize:"16px", color:C.bg, fontFamily:fuente }}>${totalCarrito.toLocaleString()}</span>
        </div>
      )}

      {/* PANEL CARRITO */}
      {verCarrito && (
        <div style={{ position:"fixed", inset:0, background:C.overlay, zIndex:200, display:"flex", alignItems:"flex-end" }}
          onClick={() => { setVerCarrito(false); document.body.style.overflow=""; }}>
          <div style={{ background:C.bgModal, borderRadius:"24px 24px 0 0", padding:"1.5rem", width:"100%", maxHeight:"88vh", display:"flex", flexDirection:"column", gap:"1rem", border:`1px solid ${C.border}`, borderBottom:"none" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <h2 style={{ color:C.text, fontFamily:fuente, fontWeight:"700", fontSize:"1.2rem", margin:0 }}>Tu pedido</h2>
              <button style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:"50%", width:"34px", height:"34px", cursor:"pointer", fontSize:"16px", color:C.textSub, display:"flex", alignItems:"center", justifyContent:"center" }}
                onClick={() => { setVerCarrito(false); document.body.style.overflow=""; }}>✕</button>
            </div>

            <div style={{ overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:"8px" }}>
              {carrito.map(item => (
                <div key={item.id} style={{ background:C.card, borderRadius:"14px", padding:"12px 14px", border:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    {item.imagenUrl && <img src={item.imagenUrl} alt={item.nombre} style={{ width:"48px", height:"48px", borderRadius:"8px", objectFit:"cover", flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:"600", fontSize:"14px", color:C.text, fontFamily:fuente, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.nombre}</div>
                      <div style={{ fontSize:"12px", color:C.textSub }}>${Number(item.precio).toLocaleString()} c/u</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <button style={{ width:"26px", height:"26px", borderRadius:"50%", background:"transparent", border:`1px solid ${C.border}`, color:C.gold, fontSize:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => quitarDelCarrito(item.id)}>−</button>
                      <span style={{ fontWeight:"800", color:C.gold, minWidth:"18px", textAlign:"center" }}>{item.cantidad}</span>
                      <button style={{ width:"26px", height:"26px", borderRadius:"50%", background:C.gold, border:"none", color:C.bg, fontSize:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => agregarAlCarrito(item)}>+</button>
                    </div>
                    <span style={{ fontWeight:"700", fontSize:"14px", color:C.gold, fontFamily:fuente, minWidth:"55px", textAlign:"right" }}>${(Number(item.precio)*item.cantidad).toLocaleString()}</span>
                  </div>
                  <input type="text" value={item.nota||""} onChange={e => actualizarNota(item.id, e.target.value)} placeholder="Aclaración especial..." style={{ width:"100%", marginTop:"8px", padding:"7px 10px", borderRadius:"8px", background:C.bg, border:`1px solid ${C.border}`, color:C.textSub, fontSize:"12px", boxSizing:"border-box", outline:"none", fontFamily:sans }} />
                </div>
              ))}
            </div>

            {!mesaDesdeQR && (
              <div>
                <label style={{ fontSize:"10px", fontWeight:"700", color:C.textSub, display:"block", marginBottom:"6px", letterSpacing:"2px", textTransform:"uppercase" }}>Número de mesa</label>
                <input type="text" placeholder="Ej: 5" value={mesa} onChange={e => setMesa(e.target.value)} style={{ width:"100%", padding:"12px 14px", borderRadius:"10px", background:C.card, border:`1px solid ${C.border}`, color:C.text, fontSize:"15px", boxSizing:"border-box", outline:"none", fontFamily:sans }} />
              </div>
            )}

            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:"1rem", display:"flex", flexDirection:"column", gap:"12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"14px", color:C.textSub, fontFamily:fuente }}>Total</span>
                <span style={{ fontSize:"1.8rem", fontWeight:"900", color:C.gold, fontFamily:fuente }}>${totalCarrito.toLocaleString()}</span>
              </div>
              <button style={{ background:C.gold, color:C.bg, border:"none", borderRadius:"14px", padding:"17px", fontWeight:"800", fontSize:"16px", cursor:"pointer", opacity:enviando?0.7:1, fontFamily:fuente }} onClick={confirmarPedido} disabled={enviando}>
                {enviando ? "Enviando..." : "Confirmar pedido"}
              </button>
              <p style={{ textAlign:"center", fontSize:"12px", color:`${C.text}50`, margin:0 }}>Un mozo confirmará tu pedido en instantes</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        *{-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{display:none}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  );
}

// ── Tarjeta de producto ──────────────────────────────────────
function ProductoCard({ producto, item, C, fuente, onVerDetalle, onAgregar, onQuitar }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background:C.card, borderRadius:"16px", overflow:"hidden", border:`1px solid ${hovered?C.borderHover:C.border}`, transition:"border-color 0.25s, transform 0.25s, box-shadow 0.25s", transform:hovered?"translateY(-3px)":"none", boxShadow:hovered?`0 10px 28px ${hexToRgba(C.gold,0.1)}`:"none", cursor:"pointer", display:"flex", flexDirection:"column" }}>
      <div style={{ position:"relative", width:"100%", paddingTop:"72%", overflow:"hidden" }} onClick={onVerDetalle}>
        {producto.imagenUrl ? (
          <img src={producto.imagenUrl} alt={producto.nombre} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.5s ease", transform:hovered?"scale(1.06)":"scale(1)" }} />
        ) : (
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 40% 40%, ${lighten(C.bg,0.15)} 0%, ${C.bg} 100%)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:"2.8rem", opacity:0.35 }}>{producto.categoria?.icono||"🍽️"}</span>
          </div>
        )}
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(to top, ${hexToRgba(C.card,0.75)} 0%, transparent 55%)` }} />
        {item && <div style={{ position:"absolute", top:"8px", right:"8px", background:C.gold, color:C.bg, borderRadius:"50%", width:"22px", height:"22px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:"900" }}>{item.cantidad}</div>}
        <div style={{ position:"absolute", bottom:"8px", left:"10px", fontSize:"10px", color:"rgba(255,255,255,0.4)", letterSpacing:"1px" }}>VER DETALLE</div>
      </div>
      <div style={{ padding:"10px 12px 12px", flex:1, display:"flex", flexDirection:"column", gap:"5px" }} onClick={onVerDetalle}>
        <h3 style={{ fontFamily:fuente, fontSize:"13px", fontWeight:"700", color:C.text, margin:0, lineHeight:1.3 }}>{producto.nombre}</h3>
        {producto.descripcion && <p style={{ fontSize:"11px", color:C.textSub, margin:0, lineHeight:1.45, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{producto.descripcion}</p>}
        <div style={{ marginTop:"auto", paddingTop:"6px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontFamily:fuente, fontWeight:"800", fontSize:"14px", color:C.gold }}>${Number(producto.precio).toLocaleString()}</span>
          {item ? (
            <div style={{ display:"flex", alignItems:"center", gap:"5px" }} onClick={e => e.stopPropagation()}>
              <button style={{ width:"22px", height:"22px", borderRadius:"50%", background:"transparent", border:`1px solid ${C.border}`, color:C.gold, fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onQuitar}>−</button>
              <span style={{ fontWeight:"800", color:C.gold, fontSize:"12px", minWidth:"14px", textAlign:"center" }}>{item.cantidad}</span>
              <button style={{ width:"22px", height:"22px", borderRadius:"50%", background:C.gold, border:"none", color:C.bg, fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onAgregar}>+</button>
            </div>
          ) : (
            <button style={{ width:"26px", height:"26px", borderRadius:"50%", background:"transparent", border:`1.5px solid ${C.gold}`, color:C.gold, fontSize:"15px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e => { e.stopPropagation(); onAgregar(); }}>+</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers de color ─────────────────────────────────────────
function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith("#")) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex, amount) {
  if (!hex || !hex.startsWith("#")) return hex;
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + Math.round(255*amount));
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + Math.round(255*amount));
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + Math.round(255*amount));
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

function buildColors(cfg) {
  const gold  = cfg.colorPrimario || "#C8913A";
  const bg    = cfg.colorFondo    || "#0f0d0b";
  const card  = cfg.colorCard     || "#1a1712";
  const text  = cfg.colorTexto    || "#F0E6D3";
  return {
    gold,
    bg,
    card,
    bgModal:    lighten(bg, -0.02),
    text,
    textSub:    hexToRgba(text, 0.55),
    goldFaded:  hexToRgba(gold, 0.12),
    border:     hexToRgba(gold, 0.14),
    borderHover:hexToRgba(gold, 0.38),
    overlay:    hexToRgba(bg, 0.92),
  };
}