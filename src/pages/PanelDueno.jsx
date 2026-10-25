import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { io } from "socket.io-client";
import "../admin.css";
import Ticket from "../components/Ticket";
import { useNavigate } from "react-router-dom";
import { useTema } from "../context/ThemeContext";
import SelectorTema from "../components/SelectorTema";
import ImageUploader from "../components/ImageUploader";
import { leerConfig, guardarConfig, FUENTES_DISPONIBLES } from "../utils/menuConfig";

const SECCIONES = [
  { id: "dashboard",  label: "Dashboard" },
  { id: "productos",  label: "Productos" },
  { id: "stock",      label: "Stock" },
  { id: "usuarios",   label: "Usuarios" },
  { id: "caja",       label: "Caja" },
  { id: "categorias", label: "Categorías" },
  { id: "qrmesas",    label: "QR Mesas" },
  { id: "apariencia", label: "Apariencia" },
  { id: "config",     label: "Config." },
];

export default function PanelDueno() {
  const { usuario, logout } = useAuth();
  const { tema } = useTema();
  const s = getStyles(tema);
  const [seccion, setSeccion] = useState("dashboard");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="admin-shell" style={s.root}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <button className="admin-menu-btn" style={s.menuBtn} onClick={() => setMenuAbierto(!menuAbierto)}><span aria-hidden="true" className="hc-menu-glyph"><i></i><i></i><i></i></span><span className="hc-sr-only">Abrir menú</span></button>
          <span style={s.headerTitulo}>HaceCafe Admin</span>
        </div>
        <div style={s.headerRight}>
          <SelectorTema />
          <span style={s.headerUsuario}>{usuario?.nombre}</span>
          <button style={s.btnLogout} onClick={() => navigate("/empleado")}>Tomar pedido</button>
          <button style={s.btnLogout} onClick={logout}>Salir</button>
        </div>
      </div>

      <div style={s.layout}>
        <div className={`admin-sidebar${menuAbierto ? " open" : ""}`} style={s.sidebar}>
          {SECCIONES.map((sec) => (
            <button key={sec.id}
              style={{ ...s.sidebarBtn, ...(seccion === sec.id ? s.sidebarBtnActivo : {}) }}
              onClick={() => { setSeccion(sec.id); setMenuAbierto(false); }}>
              {sec.label}
            </button>
          ))}
        </div>

        {menuAbierto && <div className="admin-overlay" onClick={() => setMenuAbierto(false)} />}

        <div className="admin-contenido" style={s.contenido}>
          {seccion === "dashboard"  && <Dashboard  tema={tema} />}
          {seccion === "productos"  && <Productos  tema={tema} />}
          {seccion === "stock"      && <Stock      tema={tema} />}
          {seccion === "usuarios"   && <Usuarios   tema={tema} />}
          {seccion === "caja"       && <Caja       tema={tema} />}
          {seccion === "categorias" && <Categorias tema={tema} />}
          {seccion === "qrmesas"    && <QRMesas    tema={tema} />}
          {seccion === "apariencia" && <Apariencia tema={tema} />}
          {seccion === "config"     && <Configuracion tema={tema} />}
        </div>
      </div>

      <div className="admin-nav-mobile" style={{ display: "none" }}>
        {SECCIONES.map((sec) => (
          <button key={sec.id}
            style={{ ...getStyles(tema).sidebarBtn, flex: 1, textAlign: "center", borderLeft: "none", borderTop: seccion === sec.id ? `2px solid ${tema.gold}` : "2px solid transparent", fontSize: "11px", padding: "8px 2px" }}
            onClick={() => setSeccion(sec.id)}>
            {sec.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────

function Dashboard({ tema }) {
  const s = getStyles(tema);
  const hoy = new Date().toISOString().split("T")[0];

  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [productos, setProductos] = useState([]);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [productoId, setProductoId] = useState("");
  const [filtrosActivos, setFiltrosActivos] = useState({ desde: hoy, hasta: hoy, productoId: "" });

  const cargar = useCallback(() => {
    setCargando(true);
    const params = new URLSearchParams();
    params.append("desde", filtrosActivos.desde);
    params.append("hasta", filtrosActivos.hasta);
    if (filtrosActivos.productoId) params.append("productoId", filtrosActivos.productoId);
    api.get(`/admin/dashboard?${params.toString()}`).then((r) => setData(r.data)).finally(() => setCargando(false));
  }, [filtrosActivos]);

  const buscar = () => setFiltrosActivos({ desde, hasta, productoId });

  useEffect(() => { api.get("/admin/productos").then((r) => setProductos(r.data)); }, []);
  useEffect(() => {
    cargar();
    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3001", { transports: ["websocket"], reconnection: true });
    socket.on("stock_bajo", (p) => alert(`Stock bajo: ${p.nombre} — quedan ${p.stockActual} unidades`));
    return () => socket.disconnect();
  }, [cargar]);

  if (cargando) return <div style={s.cargando}>Cargando dashboard...</div>;
  if (!data) return null;

  const margenTotal = data.topProductos.reduce((acc, p) => acc + (p.margen || 0), 0);
  const maxHora = data.ventasPorHora.length > 0 ? Math.max(...data.ventasPorHora.map((x) => x.total)) : 0;
  const maxProducto = data.topProductos.length > 0 ? Math.max(...data.topProductos.map((p) => p.total)) : 0;
  const totalMetodos = (data.porMetodoPago || []).reduce((a, m) => a + m.total, 0);
  const COLORES_METODO = { EFECTIVO: tema.verde, QR: tema.accent, TRANSFERENCIA: tema.gold, TARJETA: "#85B7EB" };
  const COLORES_TOP = [tema.gold, tema.accent, tema.verde, "#85B7EB", "#C87070"];
  const labelRango = filtrosActivos.desde === filtrosActivos.hasta
    ? new Date(filtrosActivos.desde + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    : `${new Date(filtrosActivos.desde + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })} → ${new Date(filtrosActivos.hasta + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;

  return (
    <div style={s.seccion}>
      <div style={s.filtrosCard}>
        <div style={s.filtrosRow}>
          <div style={s.filtroGrupo}><label style={s.formLabel}>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={s.filtroInput} /></div>
          <div style={s.filtroGrupo}><label style={s.formLabel}>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={s.filtroInput} /></div>
          <div style={{ ...s.filtroGrupo, flex: 2 }}>
            <label style={s.formLabel}>Producto (opcional)</label>
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)} style={s.filtroInput}>
              <option value="">Todos los productos</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div style={s.filtroAcciones}>
            <button style={s.btnBuscar} onClick={buscar}>Buscar</button>
            <button style={s.btnRefresh} onClick={cargar} title="Recargar"><span aria-hidden="true" className="hc-refresh-glyph">↻</span></button>
          </div>
        </div>
        {filtrosActivos.desde !== hoy || filtrosActivos.hasta !== hoy ? (
          <div style={{ fontSize: "12px", color: tema.gold }}>
            Mostrando: <strong>{labelRango}</strong>{" · "}
            <span style={{ color: tema.textFaded, cursor: "pointer", textDecoration: "underline" }}
              onClick={() => { setDesde(hoy); setHasta(hoy); setProductoId(""); setFiltrosActivos({ desde: hoy, hasta: hoy, productoId: "" }); }}>
              Volver a hoy
            </span>
          </div>
        ) : (
          <div style={{ fontSize: "12px", color: tema.textFaded }}>Mostrando: <strong style={{ color: tema.gold }}>Hoy</strong></div>
        )}
      </div>

      <div style={s.kpiGrid}>
        {[
          { label: "Ventas del período", valor: `$${data.totalDia.toLocaleString()}`, sub: `${data.cantidadPedidos} pedidos`, color: tema.gold },
          { label: "Ganancia estimada", valor: `$${data.gananciaEstimada.toLocaleString()}`, sub: `${data.totalDia > 0 ? Math.round((data.gananciaEstimada / data.totalDia) * 100) : 0}% margen`, color: tema.accent },
          { label: "Pedidos activos", valor: `${data.pedidosActivos}`, sub: "en este momento", color: tema.verde },
          { label: "Stock bajo", valor: `${data.stockBajo.length}`, sub: "productos a reponer", color: data.stockBajo.length > 0 ? tema.alertaText : tema.verde },
          { label: "Ticket promedio", valor: `$${data.cantidadPedidos > 0 ? Math.round(data.totalDia / data.cantidadPedidos).toLocaleString() : 0}`, sub: "por pedido", color: "#85B7EB" },
          { label: "Ganancia total", valor: `$${margenTotal.toLocaleString()}`, sub: "sobre costo", color: tema.verde },
        ].map((k, i) => (
          <div key={i} style={{ ...s.kpiCard, borderTop: `3px solid ${k.color}` }}>
            <div style={s.kpiLabel}>{k.label}</div>
            <div style={{ ...s.kpiValor, color: k.color }}>{k.valor}</div>
            <div style={s.kpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>

      {data.stockBajo.length > 0 && (
        <div style={s.alertaBox}>
          <div style={s.alertaTitulo}><span className="hc-status-mark" aria-hidden="true">!</span> Reponer urgente</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {data.stockBajo.map((p) => (
              <div key={p.id} style={s.alertaChip}><span style={{ fontWeight: "700" }}>{p.nombre}</span><span style={{ opacity: 0.8, fontSize: "11px" }}> — {p.stockActual}/{p.stockMinimo} mín.</span></div>
            ))}
          </div>
        </div>
      )}

      {(data.ventasPorHora.length > 0 || data.topProductos.length > 0) && (
        <div style={s.graficosRow}>
          {data.ventasPorHora.length > 0 && (
            <div style={{ ...s.card, flex: "2 1 380px" }}>
              <div style={s.cardHeader}>
                <h3 style={s.cardTitulo}>Ventas por hora</h3>
                <span style={s.cardSubtitulo}>Pico: {data.ventasPorHora.reduce((mx, v) => v.total > mx.total ? v : mx, data.ventasPorHora[0])?.hora}h</span>
              </div>
              <div className="hc-sales-chart" role="img" aria-label="Ventas por hora del período">
                <div className="hc-chart-scale"><span>$0</span><span>${(maxHora / 2).toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span><span>${maxHora.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span></div>
                <div className="hc-sales-rows">
                  {data.ventasPorHora.map((v, i) => {
                    const pct = maxHora > 0 ? (v.total / maxHora) * 100 : 0;
                    const esPico = v.total === maxHora && maxHora > 0;
                    return <div className="hc-sales-row" key={i}>
                      <span className={`hc-sales-hour${esPico ? " is-peak" : ""}`}>{String(v.hora).padStart(2, "0")}:00</span>
                      <div className="hc-sales-track"><div className={`hc-sales-fill${esPico ? " is-peak" : ""}`} style={{ width: `${pct}%` }} /></div>
                      <strong className="hc-sales-value">${v.total.toLocaleString("es-AR")}</strong>
                    </div>;
                  })}
                </div>
              </div>
            </div>
          )}
          {data.topProductos.length > 0 && (
            <div style={{ ...s.card, flex: "1 1 260px" }}>
              <div style={s.cardHeader}><h3 style={s.cardTitulo}>Top productos</h3><span style={s.cardSubtitulo}>{labelRango}</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
                {data.topProductos.slice(0, 6).map((p, i) => {
                  const pct = maxProducto > 0 ? (p.total / maxProducto) * 100 : 0;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: tema.text, fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "58%" }}>{p.nombre}</span>
                        <span style={{ color: COLORES_TOP[i] || tema.gold, fontWeight: "800", fontSize: "12px" }}>{p.cantidad} ud · ${p.total.toLocaleString()}</span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "4px", background: `${tema.gold}20` }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "4px", background: COLORES_TOP[i] || tema.gold, transition: "width 0.6s ease" }} />
                      </div>
                      {p.margen !== undefined && <div style={{ fontSize: "11px", color: p.margen >= 0 ? tema.verde : tema.alertaText }}>margen +${p.margen.toLocaleString()}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {(data.porMetodoPago?.length > 0 || data.topProductos.length > 0) && (
        <div style={s.graficosRow}>
          {data.porMetodoPago?.length > 0 && (
            <div style={{ ...s.card, flex: "1 1 240px" }}>
              <div style={s.cardHeader}><h3 style={s.cardTitulo}>Métodos de pago</h3><span style={s.cardSubtitulo}>${totalMetodos.toLocaleString()} total</span></div>
              <DonutChart data={data.porMetodoPago} total={totalMetodos} colores={COLORES_METODO} tema={tema} />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.porMetodoPago.map((m, i) => {
                  const pct = totalMetodos > 0 ? Math.round((m.total / totalMetodos) * 100) : 0;
                  const color = COLORES_METODO[m.metodo] || tema.gold;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: "13px", color: tema.text }}>{m.metodo}</span>
                      <span style={{ fontSize: "12px", color: tema.textFaded }}>{m.pedidos} ped.</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color, minWidth: "38px", textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {data.topProductos.length > 0 && (
            <div style={{ ...s.card, flex: "2 1 340px" }}>
              <div style={s.cardHeader}><h3 style={s.cardTitulo}>Rendimiento del período</h3></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={s.statBox}><div style={s.statLabel}><span className="hc-stat-mark" aria-hidden="true">01</span> Producto estrella</div><div style={{ ...s.statValor, color: tema.gold }}>{data.topProductos[0]?.nombre || "—"}</div><div style={s.statSub}>{data.topProductos[0]?.cantidad || 0} unidades</div></div>
                {margenTotal > 0 && <div style={s.statBox}><div style={s.statLabel}><span className="hc-stat-mark" aria-hidden="true">02</span> Mayor margen</div><div style={{ ...s.statValor, color: tema.verde }}>{[...data.topProductos].sort((a, b) => (b.margen||0)-(a.margen||0))[0]?.nombre||"—"}</div><div style={s.statSub}>+${[...data.topProductos].sort((a,b)=>(b.margen||0)-(a.margen||0))[0]?.margen?.toLocaleString()||0}</div></div>}
                {data.ventasPorHora.length > 0 && <div style={s.statBox}><div style={s.statLabel}><span className="hc-stat-mark" aria-hidden="true">03</span> Hora pico</div><div style={{ ...s.statValor, color: tema.accent }}>{data.ventasPorHora.reduce((mx,v)=>v.total>mx.total?v:mx,data.ventasPorHora[0])?.hora}:00h</div><div style={s.statSub}>${data.ventasPorHora.reduce((mx,v)=>v.total>mx.total?v:mx,data.ventasPorHora[0])?.total?.toLocaleString()} esa hora</div></div>}
                <div style={s.statBox}><div style={s.statLabel}><span className="hc-stat-mark" aria-hidden="true">04</span> Margen sobre ventas</div><div style={{ ...s.statValor, color: margenTotal > 0 ? tema.verde : tema.textFaded }}>{data.totalDia > 0 ? Math.round((margenTotal/data.totalDia)*100) : 0}%</div><div style={s.statSub}>sobre ventas totales</div></div>
              </div>
              <div style={{ borderTop: `1px solid ${tema.separador}`, paddingTop: "12px" }}>
                <div style={{ fontSize: "11px", color: tema.textFaded, fontWeight: "700", marginBottom: "8px", letterSpacing: "0.5px" }}>DETALLE TOP PRODUCTOS</div>
                {data.topProductos.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: `1px solid ${tema.separador}` }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORES_TOP[i]||tema.textFaded, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "13px", color: tema.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
                    <span style={{ fontSize: "12px", color: tema.textFaded }}>{p.cantidad} ud</span>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: COLORES_TOP[i]||tema.gold, minWidth: "70px", textAlign: "right" }}>${p.total.toLocaleString()}</span>
                    {p.margen !== undefined && <span style={{ fontSize: "12px", color: p.margen>=0?tema.verde:tema.alertaText, minWidth: "60px", textAlign: "right" }}>+${p.margen.toLocaleString()}</span>}
                  </div>
                ))}
                {margenTotal > 0 && <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "8px", fontSize: "14px", fontWeight: "800", color: tema.verde }}>Ganancia total: +${margenTotal.toLocaleString()}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {data.cantidadPedidos === 0 && <div style={s.vacio}>Sin ventas para este período</div>}
    </div>
  );
}

// ─── DONUT CHART ──────────────────────────────────────────────

function DonutChart({ data, total, colores, tema }) {
  if (!data || data.length === 0 || total === 0) return null;
  const radio = 50, grosor = 16, cx = 65, cy = 65;
  const circ = 2 * Math.PI * radio;
  let acum = 0;
  const segs = data.map((m) => { const pct = m.total/total; const offset = circ*(1-pct); const rot = acum*360; acum += pct; return { ...m, offset, rot }; });
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx={cx} cy={cy} r={radio} fill="none" stroke={`${tema.gold}18`} strokeWidth={grosor} />
        {segs.map((seg, i) => <circle key={i} cx={cx} cy={cy} r={radio} fill="none" stroke={colores[seg.metodo]||tema.gold} strokeWidth={grosor} strokeDasharray={circ} strokeDashoffset={seg.offset} strokeLinecap="round" transform={`rotate(${seg.rot-90} ${cx} ${cy})`} style={{ transition: "stroke-dashoffset 0.6s ease" }} />)}
        <text x={cx} y={cy-5} textAnchor="middle" fill={tema.gold} fontSize="12" fontWeight="800">${(total/1000).toFixed(1)}k</text>
        <text x={cx} y={cy+10} textAnchor="middle" fill={tema.textFaded} fontSize="9">total</text>
      </svg>
    </div>
  );
}

// ─── PRODUCTOS ────────────────────────────────────────────────

function Productos({ tema }) {
  const s = getStyles(tema);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [mostrando, setMostrando] = useState("lista");
  const [productoEditar, setProductoEditar] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [form, setForm] = useState({ categoriaId: "", nombre: "", descripcion: "", precio: "", precioCosto: "", stockActual: "", stockMinimo: "5", tiempoPreparacion: "", imagenUrl: "", disponible: true });

  const cargar = useCallback(() => { api.get("/admin/productos").then((r) => setProductos(r.data)); api.get("/admin/categorias").then((r) => setCategorias(r.data)); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setForm({ categoriaId: categorias[0]?.id||"", nombre: "", descripcion: "", precio: "", precioCosto: "", stockActual: "0", stockMinimo: "5", tiempoPreparacion: "", imagenUrl: "", disponible: true }); setProductoEditar(null); setMostrando("nuevo"); };
  const abrirEditar = (p) => { setForm({ categoriaId: p.categoriaId, nombre: p.nombre, descripcion: p.descripcion||"", precio: p.precio, precioCosto: p.precioCosto||"", stockActual: p.stockActual, stockMinimo: p.stockMinimo, tiempoPreparacion: p.tiempoPreparacion||"", imagenUrl: p.imagenUrl||"", disponible: p.disponible }); setProductoEditar(p); setMostrando("editar"); };
  const guardar = async () => { try { if (productoEditar) await api.put(`/admin/productos/${productoEditar.id}`, form); else await api.post("/admin/productos", form); cargar(); setMostrando("lista"); } catch { alert("Error al guardar producto"); } };
  const toggleDisponible = async (p) => { await api.put(`/admin/productos/${p.id}`, { disponible: !p.disponible }); cargar(); };
  const productosFiltrados = productos.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.categoria?.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  if (mostrando !== "lista") {
    return (
      <div style={s.seccion}>
        <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>{productoEditar ? "Editar producto" : "Nuevo producto"}</h2><button style={s.btnSecundario} onClick={() => setMostrando("lista")}>Cancelar</button></div>
        <div style={s.card}>
          <div className="admin-form-grid" style={s.formGrid}>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Categoría</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <select style={{ ...s.formInput, flex: 1 }} value={form.categoriaId} onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button style={{ ...s.btnSecundario, padding: "8px 12px", fontSize: "13px", whiteSpace: "nowrap" }} onClick={async () => { const nombre = prompt("Nombre de la nueva categoría:"); if (!nombre) return; const icono = ""; await api.post("/categorias/nueva", { nombre, icono }); api.get("/admin/categorias").then((r) => setCategorias(r.data)); }}>+ Nueva</button>
              </div>
            </div>
            <div style={s.formGrupo}><label style={s.formLabel}>Nombre</label><input style={s.formInput} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
            <div style={{ ...s.formGrupo, gridColumn: "1/-1" }}><label style={s.formLabel}>Descripción</label><textarea style={{ ...s.formInput, resize: "none" }} rows={2} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Precio de venta</label><input style={s.formInput} type="number" value={form.precio} onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))} /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Precio de costo</label><input style={s.formInput} type="number" value={form.precioCosto} onChange={(e) => setForm((f) => ({ ...f, precioCosto: e.target.value }))} /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Stock inicial</label><input style={s.formInput} type="number" value={form.stockActual} onChange={(e) => setForm((f) => ({ ...f, stockActual: e.target.value }))} /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Stock mínimo (alerta)</label><input style={s.formInput} type="number" value={form.stockMinimo} onChange={(e) => setForm((f) => ({ ...f, stockMinimo: e.target.value }))} /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Tiempo preparación (min)</label><input style={s.formInput} type="number" value={form.tiempoPreparacion} onChange={(e) => setForm((f) => ({ ...f, tiempoPreparacion: e.target.value }))} /></div>
            <div style={{ ...s.formGrupo, gridColumn: "1/-1" }}><label style={s.formLabel}>Imagen del producto</label><ImageUploader value={form.imagenUrl} onChange={(url) => setForm((f) => ({ ...f, imagenUrl: url }))} /></div>
            <div style={{ ...s.formGrupo, gridColumn: "1/-1" }}><label style={s.checkLabel}><input type="checkbox" checked={form.disponible} onChange={(e) => setForm((f) => ({ ...f, disponible: e.target.checked }))} /> Disponible en el menú</label></div>
          </div>
          <button style={s.btnPrimario} onClick={guardar}>{productoEditar ? "Guardar cambios" : "Crear producto"}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>Productos ({productos.length})</h2><button style={s.btnPrimario} onClick={abrirNuevo}>+ Nuevo</button></div>
      <input type="text" placeholder="Buscar producto o categoría..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ ...s.formInput, marginBottom: "8px" }} />
      <div style={s.listaAdmin}>
        {productosFiltrados.map((p) => (
          <div key={p.id} style={{ ...s.listaItem, opacity: p.disponible ? 1 : 0.5 }}>
            <div style={s.listaItemInfo}><div style={s.listaItemNombre}>{p.nombre}</div><div style={s.listaItemSub}>{p.categoria?.nombre} · ${Number(p.precio).toLocaleString()}{p.precioCosto && ` · Margen: $${(Number(p.precio)-Number(p.precioCosto)).toLocaleString()}`}</div></div>
            <div style={s.listaItemAcciones}>
              <span style={{ ...s.stockPill, background: p.stockActual<=p.stockMinimo?tema.alertaBg:tema.verdeBg, color: p.stockActual<=p.stockMinimo?tema.alertaText:tema.verde }}>{p.stockActual} ud.</span>
              <button style={s.btnIcono} onClick={() => abrirEditar(p)}>Editar</button>
              <button style={{ ...s.btnIcono, color: p.disponible?tema.alertaText:tema.verde }} onClick={() => toggleDisponible(p)}>{p.disponible?"Pausar":"Activar"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STOCK ────────────────────────────────────────────────────

function Stock({ tema }) {
  const s = getStyles(tema);
  const [productos, setProductos] = useState([]);
  const [cantidades, setCantidades] = useState({});
  const [guardando, setGuardando] = useState({});
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(() => { api.get("/admin/productos").then((r) => { setProductos(r.data); const ini = {}; r.data.forEach((p) => { ini[p.id] = ""; }); setCantidades(ini); }); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const agregarStock = async (p) => {
    const cantidad = Number(cantidades[p.id]);
    if (!cantidad || cantidad <= 0) return;
    setGuardando((prev) => ({ ...prev, [p.id]: true }));
    try { await api.patch(`/admin/productos/${p.id}/stock`, { cantidad, operacion: "agregar" }); setCantidades((prev) => ({ ...prev, [p.id]: "" })); cargar(); }
    catch { alert("Error al actualizar stock"); }
    finally { setGuardando((prev) => ({ ...prev, [p.id]: false })); }
  };

  const filtrados = productos.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.categoria?.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  const bajos = filtrados.filter((p) => p.stockActual <= p.stockMinimo);
  const normales = filtrados.filter((p) => p.stockActual > p.stockMinimo);

  const StockRow = ({ p, primario }) => (
    <div style={s.stockRow}>
      <div style={s.stockInfo}><span style={s.stockNombre}>{p.nombre}</span><span style={primario?s.stockActualBajo:s.stockActualOk}>{primario?`${p.stockActual} ud. (mín: ${p.stockMinimo})`:`${p.stockActual} ud. disponibles`}</span></div>
      <div style={s.stockAccion}>
        <input type="number" placeholder="+ cant." min="1" value={cantidades[p.id]||""} onChange={(e) => setCantidades((prev) => ({ ...prev, [p.id]: e.target.value }))} style={s.stockInput} />
        <button style={{ ...(primario?s.btnPrimario:s.btnSecundario), padding: "8px 14px", fontSize: "13px" }} onClick={() => agregarStock(p)} disabled={guardando[p.id]}>{guardando[p.id]?"...":"Agregar"}</button>
      </div>
    </div>
  );

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>Control de stock</h2><button style={s.btnRefresh} onClick={cargar}>Actualizar</button></div>
      <input type="text" placeholder="Buscar producto o categoría..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ ...s.formInput, marginBottom: "8px" }} />
      {bajos.length > 0 && <div style={s.alertaBox}><div style={s.alertaTitulo}>Requieren reposición urgente</div>{bajos.map((p) => <StockRow key={p.id} p={p} primario />)}</div>}
      <div style={s.card}><h3 style={s.cardTitulo}>Todos los productos</h3>{normales.map((p) => <StockRow key={p.id} p={p} primario={false} />)}</div>
    </div>
  );
}

// ─── USUARIOS ─────────────────────────────────────────────────

function Usuarios({ tema }) {
  const s = getStyles(tema);
  const [usuarios, setUsuarios] = useState([]);
  const [mostrando, setMostrando] = useState("lista");
  const [usuarioEditar, setUsuarioEditar] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "EMPLEADO" });
  const ROLES = { DUEÑO: "Dueño", EMPLEADO: "Empleado", COCINA: "Cocina" };

  const cargar = useCallback(() => { api.get("/admin/usuarios").then((r) => setUsuarios(r.data)); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => { try { await api.post("/admin/usuarios", form); cargar(); setMostrando("lista"); setForm({ nombre: "", email: "", password: "", rol: "EMPLEADO" }); } catch (e) { alert(e.response?.data?.error || "Error al crear usuario"); } };
  const editar = async () => { try { const body = { nombre: form.nombre, rol: form.rol }; if (form.password) body.password = form.password; await api.put(`/admin/usuarios/${usuarioEditar.id}`, body); cargar(); setMostrando("lista"); setUsuarioEditar(null); } catch (e) { alert(e.response?.data?.error || "Error al editar usuario"); } };
  const abrirEditar = (u) => { setForm({ nombre: u.nombre, email: u.email, password: "", rol: u.rol }); setUsuarioEditar(u); setMostrando("editar"); };
  const toggle = async (id) => { await api.patch(`/admin/usuarios/${id}/toggle`); cargar(); };

  if (mostrando === "nuevo" || mostrando === "editar") {
    return (
      <div style={s.seccion}>
        <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>{mostrando==="editar"?"Editar usuario":"Nuevo usuario"}</h2><button style={s.btnSecundario} onClick={() => { setMostrando("lista"); setUsuarioEditar(null); }}>Cancelar</button></div>
        <div style={s.card}>
          <div className="admin-form-grid" style={s.formGrid}>
            <div style={s.formGrupo}><label style={s.formLabel}>Nombre completo</label><input style={s.formInput} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Email {mostrando==="editar"&&"(no editable)"}</label><input style={{ ...s.formInput, opacity: mostrando==="editar"?0.5:1 }} value={form.email} disabled={mostrando==="editar"} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>{mostrando==="editar"?"Nueva contraseña (opcional)":"Contraseña"}</label><input style={s.formInput} type="password" value={form.password} placeholder={mostrando==="editar"?"Dejá vacío para no cambiar":""} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Rol</label><select style={s.formInput} value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}><option value="EMPLEADO">Empleado</option><option value="COCINA">Cocina</option><option value="DUEÑO">Dueño</option></select></div>
          </div>
          <button style={s.btnPrimario} onClick={mostrando==="editar"?editar:crear}>{mostrando==="editar"?"Guardar cambios":"Crear usuario"}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>Usuarios ({usuarios.length})</h2><button style={s.btnPrimario} onClick={() => setMostrando("nuevo")}>+ Nuevo</button></div>
      <div style={s.listaAdmin}>
        {usuarios.map((u) => (
          <div key={u.id} style={{ ...s.listaItem, opacity: u.activo?1:0.5 }}>
            <div style={s.listaItemInfo}><div style={s.listaItemNombre}>{u.nombre}</div><div style={s.listaItemSub}>{u.email} · {ROLES[u.rol]}</div></div>
            <div style={s.listaItemAcciones}>
              <span style={{ ...s.stockPill, background: u.activo?`${tema.verde}25`:"rgba(128,128,128,0.15)", color: u.activo?tema.verde:"#888" }}>{u.activo?"Activo":"Inactivo"}</span>
              <button style={s.btnIcono} onClick={() => abrirEditar(u)}>Editar</button>
              <button style={{ ...s.btnIcono, color: u.activo?tema.alertaText:tema.verde }} onClick={() => toggle(u.id)}>{u.activo?"Desactivar":"Activar"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CAJA ─────────────────────────────────────────────────────

function Caja({ tema }) {
  const s = getStyles(tema);
  const hoy = new Date().toISOString().split("T")[0];
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [productos, setProductos] = useState([]);
  const [ticketAbierto, setTicketAbierto] = useState(null);
  const [razonSocial] = useState({ nombre: localStorage.getItem("rs_nombre")||"HaceCafe", subtitulo: localStorage.getItem("rs_subtitulo")||"Cafetería & Cocina Artesanal", direccion: localStorage.getItem("rs_direccion")||"", telefono: localStorage.getItem("rs_telefono")||"", cuit: localStorage.getItem("rs_cuit")||"" });
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [productoId, setProductoId] = useState("");
  const [filtrosActivos, setFiltrosActivos] = useState(null);

  const cargar = useCallback(() => {
    if (!filtrosActivos) return;
    setCargando(true);
    const p = new URLSearchParams();
    p.append("desde", filtrosActivos.desde); p.append("hasta", filtrosActivos.hasta);
    if (filtrosActivos.productoId) p.append("productoId", filtrosActivos.productoId);
    api.get(`/admin/caja?${p.toString()}`).then((r) => setData(r.data)).finally(() => setCargando(false));
  }, [filtrosActivos]);

  const buscar = () => setFiltrosActivos({ desde, hasta, productoId });
  useEffect(() => { api.get("/admin/productos").then((r) => setProductos(r.data)); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const exportarExcel = () => {
    if (!data || data.pedidos.length === 0) return;
    import("xlsx").then((XLSX) => {
      const filas = data.pedidos.flatMap((pedido) => pedido.items.map((item) => ({ "Pedido #": pedido.numero, Fecha: new Date(pedido.actualizadoEn).toLocaleDateString("es-AR"), Hora: new Date(pedido.actualizadoEn).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }), Mesa: pedido.mesa||"-", Producto: item.producto.nombre, Cantidad: item.cantidad, "Precio unit.": Number(item.precioUnit), Subtotal: Number(item.subtotal), "Total pedido": Number(pedido.total), "Método de pago": pedido.metodoPago||"EFECTIVO", Vendedor: pedido.usuario?.nombre||"Sistema" })));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filas);
      ws["!cols"] = [{ wch:10 },{ wch:12 },{ wch:8 },{ wch:8 },{ wch:25 },{ wch:10 },{ wch:12 },{ wch:12 },{ wch:14 },{ wch:20 }];
      XLSX.utils.book_append_sheet(wb, ws, "Detalle ventas");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.porVendedor.map((v) => ({ Vendedor: v.nombre, Pedidos: v.pedidos, "Total vendido": v.total }))), "Por vendedor");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((data.porMetodoPago||[]).map((m) => ({ Método: m.metodo, Pedidos: m.pedidos, Total: m.total }))), "Por método");
      XLSX.writeFile(wb, `hacecafe_caja_${filtrosActivos.desde}_${filtrosActivos.hasta}.xlsx`);
    });
  };

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>Caja</h2><div style={{ display:"flex", gap:"8px" }}>{data && <button style={s.btnRefresh} onClick={cargar}><span aria-hidden="true" className="hc-refresh-glyph">↻</span> Actualizar</button>}{data?.pedidos?.length>0 && <button style={s.btnPrimario} onClick={exportarExcel}>Exportar Excel</button>}</div></div>
      <div style={s.filtrosCard}>
        <div style={s.filtrosRow}>
          <div style={s.filtroGrupo}><label style={s.formLabel}>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={s.filtroInput} /></div>
          <div style={s.filtroGrupo}><label style={s.formLabel}>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={s.filtroInput} /></div>
          <div style={{ ...s.filtroGrupo, flex: 2 }}><label style={s.formLabel}>Producto (opcional)</label><select value={productoId} onChange={(e) => setProductoId(e.target.value)} style={s.filtroInput}><option value="">Todos</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
          <div style={s.filtroAcciones}><button style={s.btnBuscar} onClick={buscar}>Buscar</button></div>
        </div>
        {filtrosActivos ? <div style={{ fontSize:"12px", color:tema.textFaded }}>Período: <strong style={{ color:tema.gold }}>{filtrosActivos.desde===filtrosActivos.hasta?filtrosActivos.desde:`${filtrosActivos.desde} → ${filtrosActivos.hasta}`}</strong></div> : <div style={{ fontSize:"12px", color:tema.textFaded }}>Seleccioná un rango y apretá Buscar para ver los datos.</div>}
      </div>
      {cargando && <div style={s.cargando}>Cargando caja...</div>}
      {data && !cargando && (
        <>
          <div style={s.kpiGrid}>
            <div style={{ ...s.kpiCard, borderTop:`3px solid ${tema.gold}` }}><div style={s.kpiLabel}>Total del período</div><div style={s.kpiValor}>${data.total.toLocaleString()}</div><div style={s.kpiSub}>{filtrosActivos.desde===filtrosActivos.hasta?"1 día":`${filtrosActivos.desde} → ${filtrosActivos.hasta}`}</div></div>
            <div style={{ ...s.kpiCard, borderTop:`3px solid ${tema.accent}` }}><div style={s.kpiLabel}>Transacciones</div><div style={{ ...s.kpiValor, color:tema.accent }}>{data.cantidad}</div><div style={s.kpiSub}>pedidos cobrados</div></div>
            <div style={{ ...s.kpiCard, borderTop:`3px solid ${tema.verde}` }}><div style={s.kpiLabel}>Ticket promedio</div><div style={{ ...s.kpiValor, color:tema.verde }}>${data.cantidad>0?Math.round(data.total/data.cantidad).toLocaleString():0}</div><div style={s.kpiSub}>por pedido</div></div>
          </div>
          {data.porMetodoPago?.length>0 && <div style={s.card}><h3 style={s.cardTitulo}>Por método de pago</h3>{data.porMetodoPago.map((m,i) => <div key={i} style={s.rankRow}><div style={{ ...s.rankIndicador, background:m.metodo==="EFECTIVO"?tema.verde:m.metodo==="QR"?tema.accent:tema.gold }} /><span style={s.rankNombre}>{m.metodo}</span><span style={s.rankCantidad}>{m.pedidos} pedidos</span><span style={s.rankTotal}>${m.total.toLocaleString()}</span></div>)}</div>}
          {data.porVendedor?.length>0 && <div style={s.card}><h3 style={s.cardTitulo}>Ventas por empleado</h3>{data.porVendedor.sort((a,b)=>b.total-a.total).map((v,i) => <div key={i} style={s.rankRow}><div style={{ ...s.rankIndicador, background:i===0?tema.gold:tema.textFaded }} /><span style={s.rankNombre}>{v.nombre}</span><span style={s.rankCantidad}>{v.pedidos} pedidos</span><span style={s.rankTotal}>${v.total.toLocaleString()}</span></div>)}</div>}
          {data.pedidos.length===0 ? <div style={s.vacio}>Sin ventas para este período</div> : (
            <div style={s.card}>
              <h3 style={s.cardTitulo}>Detalle de pedidos ({data.pedidos.length})</h3>
              {ticketAbierto && <Ticket pedido={ticketAbierto} razonSocial={razonSocial} onCerrar={() => setTicketAbierto(null)} />}
              {data.pedidos.map((pedido) => (
                <div key={pedido.id} style={{ ...s.cajaRow, flexDirection:"column", alignItems:"flex-start", gap:"6px" }}>
                  <div style={{ display:"flex", width:"100%", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={s.cajaInfo}><span style={s.cajaNombre}>Pedido #{pedido.numero}</span><span style={s.cajaSub}>{new Date(pedido.actualizadoEn).toLocaleDateString("es-AR")} {new Date(pedido.actualizadoEn).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}{pedido.mesa?` · Mesa ${pedido.mesa}`:""}{pedido.usuario?` · ${pedido.usuario.nombre}`:""}</span></div>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}><span style={s.cajaTotal}>${Number(pedido.total).toLocaleString()}</span><button style={{ ...s.btnIcono, border:`1px solid ${tema.borderFaded}`, borderRadius:"8px", padding:"5px 10px" }} onClick={() => setTicketAbierto(pedido)}>Ticket</button></div>
                  </div>
                  <div style={{ width:"100%" }}>{pedido.items.map((item) => <div key={item.id} style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", color:tema.textFaded, padding:"2px 0" }}><span>{item.cantidad}x {item.producto.nombre}</span><span>${Number(item.subtotal).toLocaleString()}</span></div>)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── CATEGORÍAS ───────────────────────────────────────────────

function Categorias({ tema }) {
  const s = getStyles(tema);
  const [categorias, setCategorias] = useState([]);
  const [editando, setEditando] = useState(null);
  const [nueva, setNueva] = useState({ nombre: "", icono: "" });
  const [mostrando, setMostrando] = useState("lista");
  const ICONOS_CATEGORIA = ["CAFÉ", "PAN", "JUGO", "DULCE", "SÁNDWICH", "TÉ", "FRÍO", "BEBIDA", "POSTRE", "CHOC.", "FRESCO", "PIZZA", "SALADO", "PANQ.", "DESAY.", "INFUS.", "OTRO", "EVENTO", "TORTA", "HELADO"];

  const cargar = useCallback(() => { api.get("/admin/categorias").then((r) => setCategorias(r.data)); }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardarEdicion = async (cat) => { await api.patch(`/admin/categorias/${cat.id}`, cat); setEditando(null); cargar(); };
  const toggleActiva = async (cat) => { await api.patch(`/admin/categorias/${cat.id}`, { activa: !cat.activa }); cargar(); };
  const moverOrden = async (cat, dir) => {
    const ord = [...categorias].sort((a,b)=>(a.ordenDisplay??999)-(b.ordenDisplay??999));
    const idx = ord.findIndex((c)=>c.id===cat.id); const idxD = idx+dir;
    if (idxD<0||idxD>=ord.length) return;
    const dest = ord[idxD]; const oA = cat.ordenDisplay??idx+1, oB = dest.ordenDisplay??idxD+1;
    setCategorias((prev)=>prev.map((c)=>c.id===cat.id?{...c,ordenDisplay:oB}:c.id===dest.id?{...c,ordenDisplay:oA}:c).sort((a,b)=>(a.ordenDisplay??999)-(b.ordenDisplay??999)));
    await api.patch(`/admin/categorias/${cat.id}`,{ordenDisplay:oB}); await api.patch(`/admin/categorias/${dest.id}`,{ordenDisplay:oA});
  };
  const crearNueva = async () => { if (!nueva.nombre.trim()) return; await api.post("/admin/categorias", nueva); setNueva({ nombre:"", icono:"" }); setMostrando("lista"); cargar(); };

  if (mostrando === "nueva") {
    return (
      <div style={s.seccion}>
        <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>Nueva categoría</h2><button style={s.btnSecundario} onClick={() => setMostrando("lista")}>Cancelar</button></div>
        <div style={s.card}>
          <div style={s.formGrupo}><label style={s.formLabel}>Nombre</label><input style={s.formInput} value={nueva.nombre} onChange={(e) => setNueva((n)=>({...n,nombre:e.target.value}))} placeholder="Ej: Licuados" /></div>
          <div style={s.formGrupo}>
            <label style={s.formLabel}>Identificador visual (opcional)</label>
            <input style={s.formInput} value={nueva.icono} onChange={(e) => setNueva((n)=>({...n,icono:e.target.value}))} placeholder="Sin icono" />
            <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"8px" }}>{ICONOS_CATEGORIA.map((e) => <button key={e} style={{ fontSize:"10px", fontWeight:800, letterSpacing:"0.02em", background:nueva.icono===e?tema.bgLight:"transparent", border:`1px solid ${tema.borderFaded}`, borderRadius:"8px", padding:"8px 9px", cursor:"pointer", color:tema.gold }} onClick={() => setNueva((n)=>({...n,icono:e}))}>{e}</button>)}</div>
          </div>
          <button style={s.btnPrimario} onClick={crearNueva}>Crear categoría</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>Categorías ({categorias.length})</h2><button style={s.btnPrimario} onClick={() => setMostrando("nueva")}>+ Nueva</button></div>
      <p style={{ fontSize:"13px", color:tema.textFaded, margin:0 }}>Usá las flechas para cambiar el orden en el menú del cliente y la pantalla del empleado.</p>
      <div style={s.listaAdmin}>
        {categorias.map((cat, idx) => (
          <div key={cat.id} style={{ ...s.listaItem, opacity:cat.activa?1:0.5 }}>
            {editando?.id===cat.id ? (
              <div style={{ flex:1, display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontSize:"22px" }}>{editando.icono}</span>
                <input style={{ ...s.formInput, flex:1, minWidth:"120px" }} value={editando.nombre} onChange={(e) => setEditando((ed)=>({...ed,nombre:e.target.value}))} />
                <input style={{ ...s.formInput, width:"80px" }} value={editando.icono} placeholder="Emoji" onChange={(e) => setEditando((ed)=>({...ed,icono:e.target.value}))} />
                <button style={s.btnPrimario} onClick={() => guardarEdicion(editando)}>Guardar</button>
                <button style={s.btnSecundario} onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            ) : (
              <>
                <div style={s.listaItemInfo}><div style={{ display:"flex", alignItems:"center", gap:"8px" }}><span style={{ fontSize:"22px" }}>{cat.icono}</span><div><div style={s.listaItemNombre}>{cat.nombre}</div><div style={s.listaItemSub}>Orden: {cat.ordenDisplay??idx+1}</div></div></div></div>
                <div style={s.listaItemAcciones}>
                  <button style={{ ...s.btnIcono, fontSize:"16px" }} onClick={() => moverOrden(cat,-1)}>↑</button>
                  <button style={{ ...s.btnIcono, fontSize:"16px" }} onClick={() => moverOrden(cat,1)}>↓</button>
                  <button style={s.btnIcono} onClick={() => setEditando({...cat})}>Editar</button>
                  <button style={{ ...s.btnIcono, color:cat.activa?tema.alertaText:tema.verde }} onClick={() => toggleActiva(cat)}>{cat.activa?"Ocultar":"Mostrar"}</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── QR MESAS ─────────────────────────────────────────────────

function QRMesas({ tema }) {
  const s = getStyles(tema);
  const [cantidadMesas, setCantidadMesas] = useState(() => parseInt(localStorage.getItem("rs_mesas")||"7"));
  const nombreLocal = localStorage.getItem("rs_nombre")||"HaceCafe";
  const dominio = localStorage.getItem("rs_dominio")||window.location.origin;

  const cambiarCantidad = (n) => { const val = Math.max(1,Math.min(99,n)); setCantidadMesas(val); localStorage.setItem("rs_mesas",String(val)); };
  const mesas = Array.from({ length: cantidadMesas },(_,i)=>i+1);

  const descargarSVG = (nMesa) => { const svg = document.getElementById(`qr-mesa-${nMesa}`); if (!svg) return; const blob = new Blob([new XMLSerializer().serializeToString(svg)],{type:"image/svg+xml"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`qr-mesa-${nMesa}.svg`; a.click(); URL.revokeObjectURL(url); };
  const imprimirUna = (nMesa) => { const w = window.open("","_blank"); w.document.write(`<html><head><title>QR Mesa ${nMesa} — ${nombreLocal}</title><style>body{font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff}.card{border:3px solid #333;border-radius:16px;padding:32px;text-align:center;width:280px}.local{font-size:12px;color:#888;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}.mesa{font-size:32px;font-weight:900;color:#1a1a1a;margin-bottom:10px}.sep{width:50px;height:2px;background:#C8913A;margin:0 auto 16px}.inst{font-size:12px;color:#888;margin-top:14px}@media print{@page{margin:5mm}}</style></head><body><div class="card"><div class="local">${nombreLocal}</div><div class="mesa">Mesa ${nMesa}</div><div class="sep"></div><div id="qr"></div><div class="inst">Escaneá para hacer tu pedido</div></div><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>new QRCode(document.getElementById('qr'),{text:'${dominio}/menu?mesa=${nMesa}',width:200,height:200,colorDark:'#1a1a1a',colorLight:'#fff'});setTimeout(()=>window.print(),600)</script></body></html>`); w.document.close(); };
  const imprimirTodos = () => { const w = window.open("","_blank"); w.document.write(`<html><head><title>QR Mesas — ${nombreLocal}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;background:#fff}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:20px}.qr-card{border:2px solid #333;border-radius:12px;padding:20px;text-align:center;break-inside:avoid}.local{font-size:13px;color:#666;margin-bottom:8px;letter-spacing:2px;text-transform:uppercase}.mesa{font-size:28px;font-weight:800;margin-bottom:12px;color:#1a1a1a}.sep{width:40px;height:2px;background:#C8913A;margin:8px auto}.inst{font-size:11px;color:#888;margin-top:10px}@media print{@page{margin:10mm}}</style></head><body><div class="grid">${mesas.map((n)=>`<div class="qr-card"><div class="local">${nombreLocal}</div><div class="mesa">Mesa ${n}</div><div class="sep"></div><div id="qr-${n}"></div><div class="inst">Escaneá para hacer tu pedido</div></div>`).join("")}</div><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>${mesas.map((n)=>`new QRCode(document.getElementById('qr-${n}'),{text:'${dominio}/menu?mesa=${n}',width:160,height:160,colorDark:'#1a1a1a',colorLight:'#fff'});`).join("")}setTimeout(()=>window.print(),900)</script></body></html>`); w.document.close(); };

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>QR por mesa</h2><button style={s.btnPrimario} onClick={imprimirTodos}>🖨 Imprimir todos</button></div>
      <div style={s.card}>
        <h3 style={s.cardTitulo}>Cantidad de mesas</h3>
        <div style={{ display:"flex", alignItems:"center", gap:"16px", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <button style={s.btnContador} onClick={() => cambiarCantidad(cantidadMesas-1)} disabled={cantidadMesas<=1}>−</button>
            <span style={{ fontSize:"1.6rem", fontWeight:"900", color:tema.gold, minWidth:"42px", textAlign:"center" }}>{cantidadMesas}</span>
            <button style={{ ...s.btnContador, background:tema.accent, color:tema.accentText, border:"none" }} onClick={() => cambiarCantidad(cantidadMesas+1)}>+</button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}><span style={{ fontSize:"12px", color:tema.textFaded }}>o ingresá el número:</span><input type="number" min="1" max="99" value={cantidadMesas} onChange={(e) => cambiarCantidad(parseInt(e.target.value)||1)} style={{ ...s.formInput, width:"72px", textAlign:"center", padding:"8px" }} /></div>
        </div>
        <div style={{ fontSize:"12px", color:tema.textFaded }}>URL base: <strong style={{ color:tema.gold }}>{dominio}</strong><span style={{ marginLeft:"8px", opacity:0.6 }}>· cada QR apunta a {dominio}/menu?mesa=N</span></div>
        <div style={{ fontSize:"11px", color:tema.textFaded, opacity:0.6 }}>Tip: configurá el dominio en <strong>Config. → Dominio del sistema</strong> antes de imprimir.</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(210px, 1fr))", gap:"14px" }}>
        {mesas.map((n) => (
          <div key={n} style={{ ...s.card, alignItems:"center", textAlign:"center", gap:"10px" }}>
            <div style={{ fontSize:"11px", fontWeight:"700", color:tema.textFaded, letterSpacing:"1.5px", textTransform:"uppercase" }}>{nombreLocal}</div>
            <div style={{ fontSize:"1.5rem", fontWeight:"900", color:tema.gold, fontFamily:"Georgia, serif" }}>Mesa {n}</div>
            <div style={{ width:"40px", height:"2px", background:tema.gold, borderRadius:"2px" }} />
            <div style={{ background:"#fff", borderRadius:"10px", padding:"10px", display:"flex", alignItems:"center", justifyContent:"center" }}><QRCodeSVG id={`qr-mesa-${n}`} value={`${dominio}/menu?mesa=${n}`} size={140} bgColor="#ffffff" fgColor="#1a1a1a" level="M" includeMargin={false} /></div>
            <div style={{ fontSize:"11px", color:tema.textFaded }}>Escaneá para pedir</div>
            <div style={{ display:"flex", gap:"8px", width:"100%" }}>
              <button style={{ flex:1, ...s.btnSecundario, fontSize:"12px", padding:"8px 4px" }} onClick={() => descargarSVG(n)}>↓ SVG</button>
              <button style={{ flex:1, ...s.btnPrimario, fontSize:"12px", padding:"8px 4px" }} onClick={() => imprimirUna(n)}>🖨 Imprimir</button>
            </div>
          </div>
        ))}
      </div>
      <div style={s.card}><h3 style={s.cardTitulo}>Cómo usar</h3><div style={{ display:"flex", flexDirection:"column", gap:"6px", fontSize:"13px", color:tema.textFaded }}><div>1. Ajustá la cantidad de mesas con los botones +/− de arriba.</div><div>2. Imprimí cada QR individualmente o todos juntos en una grilla de 3 columnas.</div><div>3. Plastificá y colocá el QR en la mesa correspondiente.</div><div>4. El cliente escanea con la cámara del celular — no necesita app.</div><div>5. El menú se abre directamente con la mesa pre-cargada.</div></div></div>
    </div>
  );
}

// ─── APARIENCIA ───────────────────────────────────────────────

function Apariencia({ tema }) {
  const s = getStyles(tema);
  const [cfg, setCfg] = useState(leerConfig);
  const [guardado, setGuardado] = useState(false);

  const set = (key, val) => setCfg(prev => ({ ...prev, [key]: val }));

  const guardar = () => {
    guardarConfig(cfg);
    // Dispara el evento storage para que MenuCliente se actualice en tiempo real
    window.dispatchEvent(new Event("storage"));
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  const resetear = () => {
    if (!confirm("¿Resetear la apariencia a los valores por defecto?")) return;
    localStorage.removeItem("menu_apariencia");
    const { CONFIG_DEFAULT } = require ? { CONFIG_DEFAULT: leerConfig() } : { CONFIG_DEFAULT: leerConfig() };
    setCfg(leerConfig());
    window.dispatchEvent(new Event("storage"));
  };

  // Preview mini del menú
  const previewBg = cfg.colorFondo || "#0f0d0b";
  const previewGold = cfg.colorPrimario || "#C8913A";
  const previewText = cfg.colorTexto || "#F0E6D3";
  const previewCard = cfg.colorCard || "#1a1712";
  const fuente = FUENTES_DISPONIBLES.find(f => f.id === cfg.fuenteId)?.css || FUENTES_DISPONIBLES[0].css;

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>Apariencia del menú</h2>
        <div style={{ display:"flex", gap:"8px" }}>
          <button style={s.btnSecundario} onClick={resetear}>Resetear</button>
          <button style={s.btnPrimario} onClick={guardar}>{guardado ? "✓ Guardado" : "Guardar cambios"}</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:"1rem", alignItems:"start" }}>

        {/* ── Formulario ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

          {/* Identidad */}
          <div style={s.card}>
            <h3 style={s.cardTitulo}>Identidad del local</h3>
            <div style={s.formGrupo}><label style={s.formLabel}>Nombre del local</label><input style={s.formInput} value={cfg.nombre} onChange={e => set("nombre", e.target.value)} placeholder="HaceCafe" /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Subtítulo</label><input style={s.formInput} value={cfg.subtitulo} onChange={e => set("subtitulo", e.target.value)} placeholder="Gastronomía Artesanal" /></div>
            <div style={s.formGrupo}><label style={s.formLabel}>Frase de bienvenida (opcional)</label><textarea style={{ ...s.formInput, resize:"none" }} rows={2} value={cfg.bienvenida} onChange={e => set("bienvenida", e.target.value)} placeholder="Bienvenidos a nuestro local..." /></div>
          </div>

          {/* Imágenes */}
          <div style={s.card}>
            <h3 style={s.cardTitulo}>Imágenes</h3>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Logo del local</label>
              <ImageUploader value={cfg.logoUrl} onChange={url => set("logoUrl", url)} />
              <span style={{ fontSize:"11px", color:tema.textFaded }}>Se muestra en el hero del menú. Recomendado: fondo transparente (PNG).</span>
            </div>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Imagen de fondo del hero</label>
              <ImageUploader value={cfg.heroBgUrl} onChange={url => set("heroBgUrl", url)} />
              <span style={{ fontSize:"11px", color:tema.textFaded }}>Foto del local, plato estrella, etc. Se oscurece automáticamente para mantener la legibilidad.</span>
            </div>
          </div>

          {/* Colores */}
          <div style={s.card}>
            <h3 style={s.cardTitulo}>Colores</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              {[
                { key:"colorPrimario", label:"Color primario", hint:"Botones, precios, acentos" },
                { key:"colorFondo",    label:"Color de fondo",  hint:"Fondo general de la página" },
                { key:"colorCard",     label:"Color de tarjetas", hint:"Fondo de cards y modales" },
                { key:"colorTexto",    label:"Color de texto",  hint:"Texto principal" },
              ].map(({ key, label, hint }) => (
                <div key={key} style={s.formGrupo}>
                  <label style={s.formLabel}>{label}</label>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <input type="color" value={cfg[key]} onChange={e => set(key, e.target.value)}
                      style={{ width:"40px", height:"40px", borderRadius:"8px", border:`1px solid ${tema.borderFaded}`, cursor:"pointer", padding:"2px", background:"transparent" }} />
                    <input style={{ ...s.formInput, flex:1, fontFamily:"monospace", fontSize:"13px" }} value={cfg[key]} onChange={e => set(key, e.target.value)} placeholder="#000000" />
                  </div>
                  <span style={{ fontSize:"11px", color:tema.textFaded }}>{hint}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fuente */}
          <div style={s.card}>
            <h3 style={s.cardTitulo}>Tipografía</h3>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Fuente principal</label>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {FUENTES_DISPONIBLES.map(f => (
                  <button key={f.id} onClick={() => set("fuenteId", f.id)}
                    style={{ padding:"12px 16px", borderRadius:"10px", border:`2px solid ${cfg.fuenteId===f.id ? tema.accent : tema.borderFaded}`, background: cfg.fuenteId===f.id ? `${tema.accent}18` : "transparent", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontFamily:f.css, fontSize:"16px", color:tema.text }}>{f.label}</span>
                    <span style={{ fontFamily:f.css, fontSize:"13px", color:tema.textFaded }}>Menú Carta 2024</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Preview ── */}
        <div style={{ position:"sticky", top:"1rem" }}>
          <div style={{ ...s.card, padding:0, overflow:"hidden" }}>
            <div style={{ padding:"10px 14px", borderBottom:`1px solid ${tema.borderFaded}`, fontSize:"12px", fontWeight:"700", color:tema.textFaded, letterSpacing:"1px" }}>PREVIEW</div>
            {/* Mini hero */}
            <div style={{ position:"relative", height:"120px", background: cfg.heroBgUrl ? `url(${cfg.heroBgUrl}) center/cover` : `radial-gradient(ellipse at 30% 50%, ${lightenHex(previewBg, 0.15)} 0%, ${previewBg} 65%)`, overflow:"hidden", display:"flex", alignItems:"flex-end" }}>
              <div style={{ position:"absolute", inset:0, background:`linear-gradient(to top, ${previewBg} 0%, transparent 100%)` }} />
              <div style={{ position:"relative", zIndex:2, padding:"0 12px 12px" }}>
                {cfg.logoUrl && <img src={cfg.logoUrl} alt="logo" style={{ height:"24px", marginBottom:"4px", objectFit:"contain", display:"block" }} />}
                <div style={{ fontFamily:fuente, fontSize:"18px", fontWeight:"700", color:previewText, lineHeight:1 }}>{cfg.nombre || "Mi Local"}</div>
                {cfg.subtitulo && <div style={{ fontFamily:fuente, fontSize:"9px", color:previewGold, letterSpacing:"3px", textTransform:"uppercase", opacity:0.8 }}>{cfg.subtitulo}</div>}
              </div>
            </div>
            {/* Mini categorías */}
            <div style={{ background:previewBg, padding:"8px 10px", display:"flex", gap:"4px", borderBottom:`1px solid ${previewGold}20` }}>
              {["Cafés","Comidas","Bebidas"].map((c,i) => (
                <div key={c} style={{ padding:"4px 10px", borderRadius:"20px", fontSize:"10px", fontWeight:"600", background:i===0?previewGold:"transparent", color:i===0?previewBg:`${previewText}60` }}>{c}</div>
              ))}
            </div>
            {/* Mini productos */}
            <div style={{ background:previewBg, padding:"8px 10px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
              {["Café con leche","Medialunas","Tostado","Jugo"].map((nombre, i) => (
                <div key={nombre} style={{ background:previewCard, borderRadius:"8px", overflow:"hidden", border:`1px solid ${previewGold}15` }}>
                  <div style={{ height:"44px", background:`${lightenHex(previewBg, 0.1)}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>{["C","M","T","J"][i]}</div>
                  <div style={{ padding:"5px 6px" }}>
                    <div style={{ fontFamily:fuente, fontSize:"9px", fontWeight:"700", color:previewText, lineHeight:1.2 }}>{nombre}</div>
                    <div style={{ fontFamily:fuente, fontSize:"10px", fontWeight:"800", color:previewGold, marginTop:"2px" }}>$1.500</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Mini carrito */}
            <div style={{ margin:"8px 10px 10px", background:previewGold, borderRadius:"20px", padding:"8px 12px", display:"flex", alignItems:"center", gap:"8px" }}>
              <div style={{ background:previewBg, borderRadius:"50%", width:"18px", height:"18px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:"900", color:previewGold }}>2</div>
              <span style={{ flex:1, fontSize:"10px", fontWeight:"700", color:previewBg, fontFamily:fuente }}>Ver mi pedido</span>
              <span style={{ fontSize:"11px", fontWeight:"900", color:previewBg, fontFamily:fuente }}>$3.000</span>
            </div>
          </div>
        </div>
      </div>

      <button style={{ ...s.btnPrimario, alignSelf:"flex-start" }} onClick={guardar}>{guardado ? "✓ Guardado" : "Guardar cambios"}</button>
    </div>
  );
}

function lightenHex(hex, amount) {
  if (!hex || !hex.startsWith("#")) return hex;
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + Math.round(255*amount));
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + Math.round(255*amount));
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + Math.round(255*amount));
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────

function Configuracion({ tema }) {
  const s = getStyles(tema);
  const [form, setForm] = useState({
    rs_nombre: localStorage.getItem("rs_nombre")||"HaceCafe",
    rs_subtitulo: localStorage.getItem("rs_subtitulo")||"Cafetería & Cocina Artesanal",
    rs_direccion: localStorage.getItem("rs_direccion")||"",
    rs_telefono: localStorage.getItem("rs_telefono")||"",
    rs_cuit: localStorage.getItem("rs_cuit")||"",
    rs_mesas: localStorage.getItem("rs_mesas")||"7",
    rs_dominio: localStorage.getItem("rs_dominio")||window.location.origin,
    mp_alias: localStorage.getItem("mp_alias")||"",
    mp_cbu: localStorage.getItem("mp_cbu")||"",
    mp_titular: localStorage.getItem("mp_titular")||"",
    mp_qr_url: localStorage.getItem("mp_qr_url")||"",
    transfer_alias: localStorage.getItem("transfer_alias")||"",
    transfer_cbu: localStorage.getItem("transfer_cbu")||"",
    transfer_titular: localStorage.getItem("transfer_titular")||"",
    transfer_banco: localStorage.getItem("transfer_banco")||"",
  });
  const [guardado, setGuardado] = useState(false);
  const guardar = () => { Object.entries(form).forEach(([k,v]) => localStorage.setItem(k,v)); setGuardado(true); setTimeout(() => setGuardado(false),2000); };
  const Campo = ({ campo, label, placeholder, fullWidth }) => (
    <div style={{ ...s.formGrupo, ...(fullWidth?{gridColumn:"1/-1"}:{}) }}>
      <label style={s.formLabel}>{label}</label>
      <input style={s.formInput} value={form[campo]||""} placeholder={placeholder||""} onChange={(e) => setForm((f)=>({...f,[campo]:e.target.value}))} />
    </div>
  );

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>Configuración del negocio</h2></div>
      <div style={s.card}>
        <h3 style={s.cardTitulo}>Datos del local y tickets</h3>
        <div className="admin-form-grid" style={s.formGrid}>
          <Campo campo="rs_nombre" label="Nombre del local" />
          <Campo campo="rs_subtitulo" label="Subtítulo" />
          <Campo campo="rs_direccion" label="Dirección" />
          <Campo campo="rs_telefono" label="Teléfono" />
          <Campo campo="rs_cuit" label="CUIT / RUT" />
          <Campo campo="rs_mesas" label="Cantidad de mesas" />
          <Campo campo="rs_dominio" label="Dominio del sistema (para QR)" placeholder={window.location.origin} fullWidth />
        </div>
        <div style={{ fontSize:"11px", color:tema.textFaded }}>El dominio se usa para generar los QR de mesa. En desarrollo es <code style={{ color:tema.gold }}>{window.location.origin}</code>. Cambialo al hacer el deploy.</div>
      </div>
      <div style={s.card}>
        <h3 style={s.cardTitulo}>Mercado Pago</h3>
        <p style={{ fontSize:"12px", color:tema.textFaded, margin:0 }}>El QR se genera automáticamente desde la URL de tu QR de MP.</p>
        <div className="admin-form-grid" style={s.formGrid}>
          <Campo campo="mp_alias" label="Alias de MP" />
          <Campo campo="mp_titular" label="Titular de la cuenta" />
          <Campo campo="mp_cbu" label="CVU (opcional)" />
          <Campo campo="mp_qr_url" label="URL del QR de MP (opcional)" />
        </div>
      </div>
      <div style={s.card}>
        <h3 style={s.cardTitulo}>Transferencia bancaria</h3>
        <div className="admin-form-grid" style={s.formGrid}>
          <Campo campo="transfer_alias" label="Alias" />
          <Campo campo="transfer_titular" label="Titular" />
          <Campo campo="transfer_cbu" label="CBU" />
          <Campo campo="transfer_banco" label="Banco" />
        </div>
      </div>
      <button style={{ ...s.btnPrimario, marginTop:"4px" }} onClick={guardar}>{guardado?"✓ Guardado":"Guardar configuración"}</button>
    </div>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────

function getStyles(t) {
  return {
    root: { minHeight:"100vh", display:"flex", flexDirection:"column", background:t.bg },
    header: { background:t.bgHeader, padding:"0 1rem", height:"56px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, borderBottom:`1px solid ${t.borderFaded}` },
    headerLeft: { display:"flex", alignItems:"center", gap:"12px" },
    menuBtn: { background:"transparent", border:"none", color:t.gold, fontSize:"20px", cursor:"pointer", padding:"4px 8px" },
    headerTitulo: { color:t.gold, fontWeight:"800", fontSize:"1rem", fontFamily:"Georgia, serif" },
    headerRight: { display:"flex", alignItems:"center", gap:"10px" },
    headerUsuario: { color:t.textSidebar, fontSize:"13px" },
    btnLogout: { background:"transparent", border:"1px solid rgba(255,255,255,0.3)", color:"rgba(255,255,255,0.8)", borderRadius:"8px", padding:"5px 12px", cursor:"pointer", fontSize:"12px" },
    layout: { display:"flex", flex:1, overflow:"hidden", minHeight:0 },
    sidebar: { width:"175px", background:t.bgHeader, borderRight:`1px solid ${t.borderFaded}`, display:"flex", flexDirection:"column", padding:"1rem 0", flexShrink:0, overflowY:"auto" },
    sidebarBtn: { padding:"11px 1.2rem", border:"none", background:"transparent", textAlign:"left", cursor:"pointer", fontSize:"13px", fontWeight:"600", color:t.textSidebar, borderLeft:"3px solid transparent", transition:"all 0.15s" },
    sidebarBtnActivo: { color:t.gold, background:`${t.gold}18`, borderLeft:`3px solid ${t.gold}` },
    contenido: { flex:1, overflowY:"auto", padding:"1.5rem", minWidth:0 },
    seccion: { display:"flex", flexDirection:"column", gap:"1rem", width:"100%" },
    seccionHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"8px" },
    seccionTitulo: { fontSize:"1.2rem", fontWeight:"800", margin:0, color:t.gold, fontFamily:"Georgia, serif" },
    filtrosCard: { background:t.bgCard, borderRadius:"14px", padding:"1rem 1.2rem", border:`1px solid ${t.borderFaded}`, display:"flex", flexDirection:"column", gap:"10px" },
    filtrosRow: { display:"flex", gap:"10px", alignItems:"flex-end", flexWrap:"wrap" },
    filtroGrupo: { display:"flex", flexDirection:"column", gap:"4px", flex:1, minWidth:"120px" },
    filtroInput: { padding:"9px 12px", borderRadius:"8px", border:`1px solid ${t.borderFaded}`, fontSize:"14px", fontFamily:"inherit", background:t.inputBg, color:t.text, width:"100%", boxSizing:"border-box" },
    filtroAcciones: { display:"flex", gap:"8px", alignItems:"flex-end", flexShrink:0 },
    btnBuscar: { background:t.accent, color:t.accentText, border:"none", borderRadius:"8px", padding:"9px 20px", fontWeight:"800", fontSize:"14px", cursor:"pointer", whiteSpace:"nowrap" },
    kpiGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:"12px" },
    kpiCard: { background:t.bgCard, borderRadius:"12px", padding:"1rem 1.2rem", border:`1px solid ${t.borderFaded}` },
    kpiLabel: { fontSize:"11px", color:t.textFaded, marginBottom:"6px", fontWeight:"600", letterSpacing:"0.6px", textTransform:"uppercase" },
    kpiValor: { fontSize:"1.7rem", fontWeight:"900", color:t.gold, lineHeight:1 },
    kpiSub: { fontSize:"12px", color:t.textFaded, marginTop:"6px" },
    alertaBox: { background:t.alertaBg, border:`1px solid ${t.alertaBorder}`, borderRadius:"12px", padding:"1rem 1.2rem", display:"flex", flexDirection:"column", gap:"10px" },
    alertaTitulo: { fontWeight:"700", color:t.alertaText, fontSize:"14px" },
    alertaChip: { background:`${t.alertaText}18`, border:`1px solid ${t.alertaBorder}`, borderRadius:"20px", padding:"4px 12px", fontSize:"13px", color:t.alertaText },
    graficosRow: { display:"flex", gap:"14px", flexWrap:"wrap", alignItems:"flex-start" },
    card: { background:t.bgCard, borderRadius:"14px", padding:"1.2rem", border:`1px solid ${t.borderFaded}`, display:"flex", flexDirection:"column", gap:"10px" },
    cardHeader: { display:"flex", justifyContent:"space-between", alignItems:"baseline" },
    cardTitulo: { fontSize:"14px", fontWeight:"700", margin:0, color:t.gold },
    cardSubtitulo: { fontSize:"12px", color:t.textFaded },
    barChart: { display:"flex", alignItems:"flex-end", gap:"5px", height:"140px", paddingTop:"20px" },
    barCol: { display:"flex", flexDirection:"column", alignItems:"center", flex:1, height:"100%", minWidth:0 },
    barLabelTop: { fontSize:"9px", color:t.textFaded, marginBottom:"3px", whiteSpace:"nowrap", overflow:"hidden" },
    barWrapper: { flex:1, width:"100%", display:"flex", alignItems:"flex-end" },
    bar: { width:"100%", borderRadius:"4px 4px 0 0", minHeight:"3px", transition:"height 0.5s ease" },
    barLabelBot: { fontSize:"10px", marginTop:"4px" },
    statBox: { background:`${t.gold}10`, border:`1px solid ${t.borderFaded}`, borderRadius:"10px", padding:"12px 14px", display:"flex", flexDirection:"column", gap:"4px" },
    statLabel: { fontSize:"11px", color:t.textFaded, fontWeight:"600" },
    statValor: { fontSize:"1rem", fontWeight:"800", color:t.gold, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
    statSub: { fontSize:"11px", color:t.textFaded },
    rankRow: { display:"flex", alignItems:"center", gap:"10px", fontSize:"14px", padding:"4px 0" },
    rankIndicador: { width:"10px", height:"10px", borderRadius:"50%", flexShrink:0 },
    rankNombre: { flex:1, fontWeight:"600", color:t.text },
    rankCantidad: { color:t.textFaded, fontSize:"13px" },
    rankTotal: { fontWeight:"700", color:t.gold },
    vacio: { textAlign:"center", color:t.textFaded, padding:"3rem", fontSize:"14px" },
    cargando: { textAlign:"center", color:t.textFaded, padding:"3rem" },
    btnRefresh: { background:`${t.gold}18`, border:`1px solid ${t.borderFaded}`, borderRadius:"8px", padding:"6px 14px", cursor:"pointer", fontSize:"13px", color:t.gold },
    btnPrimario: { background:t.accent, color:t.accentText, border:"none", borderRadius:"10px", padding:"11px 20px", fontWeight:"800", fontSize:"14px", cursor:"pointer" },
    btnSecundario: { background:"transparent", color:t.text, border:`1.5px solid ${t.borderFaded}`, borderRadius:"10px", padding:"10px 18px", fontWeight:"600", fontSize:"14px", cursor:"pointer" },
    btnIcono: { background:"transparent", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:"600", color:t.gold, padding:"4px 8px" },
    btnContador: { width:"36px", height:"36px", borderRadius:"50%", background:t.bgLight, border:`1px solid ${t.borderFaded}`, fontSize:"20px", fontWeight:"700", color:t.gold, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
    listaAdmin: { display:"flex", flexDirection:"column", gap:"8px" },
    listaItem: { background:t.bgCard, borderRadius:"10px", padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", border:`1px solid ${t.borderFaded}` },
    listaItemInfo: { flex:1, minWidth:0 },
    listaItemNombre: { fontWeight:"700", fontSize:"14px", color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
    listaItemSub: { fontSize:"12px", color:t.textFaded, marginTop:"2px" },
    listaItemAcciones: { display:"flex", alignItems:"center", gap:"8px", flexShrink:0 },
    stockPill: { borderRadius:"20px", padding:"3px 10px", fontSize:"12px", fontWeight:"700" },
    formGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" },
    formGrupo: { display:"flex", flexDirection:"column", gap:"4px" },
    formLabel: { fontSize:"12px", fontWeight:"600", color:t.textFaded, letterSpacing:"0.5px" },
    formInput: { padding:"10px 12px", borderRadius:"8px", border:`1px solid ${t.borderFaded}`, fontSize:"14px", fontFamily:"inherit", background:t.inputBg, color:t.text, width:"100%", boxSizing:"border-box" },
    checkLabel: { display:"flex", alignItems:"center", gap:"8px", fontSize:"14px", cursor:"pointer", color:t.text },
    stockRow: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", padding:"8px 0", borderBottom:`1px solid ${t.separador}` },
    stockInfo: { flex:1, display:"flex", flexDirection:"column", gap:"2px" },
    stockNombre: { fontSize:"14px", fontWeight:"600", color:t.text },
    stockActualOk: { fontSize:"12px", color:t.verde },
    stockActualBajo: { fontSize:"12px", color:t.alertaText, fontWeight:"700" },
    stockAccion: { display:"flex", gap:"8px", alignItems:"center" },
    stockInput: { width:"80px", padding:"8px 10px", borderRadius:"8px", border:`1px solid ${t.borderFaded}`, fontSize:"14px", textAlign:"center", background:t.inputBg, color:t.text },
    cajaRow: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${t.separador}` },
    cajaInfo: { display:"flex", flexDirection:"column", gap:"2px" },
    cajaNombre: { fontSize:"14px", fontWeight:"600", color:t.text },
    cajaSub: { fontSize:"12px", color:t.textFaded },
    cajaTotal: { fontSize:"15px", fontWeight:"800", color:t.gold },
  };
}