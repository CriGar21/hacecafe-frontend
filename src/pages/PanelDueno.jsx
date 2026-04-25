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

const SECCIONES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "productos", label: "Productos" },
  { id: "stock", label: "Stock" },
  { id: "usuarios", label: "Usuarios" },
  { id: "caja", label: "Caja" },
  { id: "categorias", label: "Categorías" },
  { id: "qrmesas", label: "QR Mesas" },
  { id: "config", label: "Config." },
];

// ─── PANEL DUEÑO ──────────────────────────────────────────────

export default function PanelDueno() {
  const { usuario, logout } = useAuth();
  const { tema } = useTema();
  const s = getStyles(tema);
  const [seccion, setSeccion] = useState("dashboard");
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navigate = useNavigate();

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <button
            className="admin-menu-btn"
            style={s.menuBtn}
            onClick={() => setMenuAbierto(!menuAbierto)}
          >
            ☰
          </button>
          <span style={s.headerTitulo}>HaceCafe Admin</span>
        </div>
        <div style={s.headerRight}>
          <SelectorTema />
          <span style={s.headerUsuario}>{usuario?.nombre}</span>
          <button style={s.btnLogout} onClick={() => navigate("/empleado")}>
            Tomar pedido
          </button>
          <button style={s.btnLogout} onClick={logout}>
            Salir
          </button>
        </div>
      </div>

      <div style={s.layout}>
        <div
          className={`admin-sidebar${menuAbierto ? " open" : ""}`}
          style={s.sidebar}
        >
          {SECCIONES.map((sec) => (
            <button
              key={sec.id}
              style={{
                ...s.sidebarBtn,
                ...(seccion === sec.id ? s.sidebarBtnActivo : {}),
              }}
              onClick={() => {
                setSeccion(sec.id);
                setMenuAbierto(false);
              }}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {menuAbierto && (
          <div
            className="admin-overlay"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        <div className="admin-contenido" style={s.contenido}>
          {seccion === "dashboard" && <Dashboard tema={tema} />}
          {seccion === "productos" && <Productos tema={tema} />}
          {seccion === "stock" && <Stock tema={tema} />}
          {seccion === "usuarios" && <Usuarios tema={tema} />}
          {seccion === "caja" && <Caja tema={tema} />}
          {seccion === "categorias" && <Categorias tema={tema} />}
          {seccion === "qrmesas" && <QRMesas tema={tema} />}
          {seccion === "config" && <Configuracion tema={tema} />}
        </div>
      </div>

      <div className="admin-nav-mobile" style={{ display: "none" }}>
        {SECCIONES.map((sec) => (
          <button
            key={sec.id}
            style={{
              ...getStyles(tema).sidebarBtn,
              flex: 1,
              textAlign: "center",
              borderLeft: "none",
              borderTop:
                seccion === sec.id
                  ? `2px solid ${tema.gold}`
                  : "2px solid transparent",
              fontSize: "11px",
              padding: "8px 2px",
            }}
            onClick={() => setSeccion(sec.id)}
          >
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
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [productos, setProductos] = useState([]);
  const [productoId, setProductoId] = useState("");

  const cargar = useCallback(() => {
    setCargando(true);
    const params = new URLSearchParams();
    params.append("fecha", fecha);
    if (productoId) params.append("productoId", productoId);
    api
      .get(`/admin/dashboard?${params.toString()}`)
      .then((r) => setData(r.data))
      .finally(() => setCargando(false));
  }, [fecha, productoId]);

  useEffect(() => {
    api.get("/admin/productos").then((r) => setProductos(r.data));
  }, []);

  useEffect(() => {
    cargar();
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
      { transports: ["websocket"] },
    );
    socket.on("stock_bajo", (p) =>
      alert(`Stock bajo: ${p.nombre} — quedan ${p.stockActual} unidades`),
    );
    return () => socket.disconnect();
  }, [cargar]);

  if (cargando) return <div style={s.cargando}>Cargando dashboard...</div>;
  if (!data) return null;

  const margenTotal = data.topProductos.reduce(
    (acc, p) => acc + (p.margen || 0),
    0,
  );
  const maxHora =
    data.ventasPorHora.length > 0
      ? Math.max(...data.ventasPorHora.map((x) => x.total))
      : 0;
  const maxProducto =
    data.topProductos.length > 0
      ? Math.max(...data.topProductos.map((p) => p.total))
      : 0;
  const totalMetodos = (data.porMetodoPago || []).reduce(
    (a, m) => a + m.total,
    0,
  );

  const COLORES_METODO = {
    EFECTIVO: tema.verde,
    QR: tema.accent,
    TRANSFERENCIA: tema.gold,
    TARJETA: "#85B7EB",
  };
  const COLORES_TOP = [
    tema.gold,
    tema.accent,
    tema.verde,
    "#85B7EB",
    "#C87070",
  ];

  return (
    <div style={s.seccion}>
      {/* Header filtros */}
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>Dashboard</h2>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={{
              ...s.formInput,
              width: "auto",
              fontSize: "13px",
              padding: "6px 10px",
            }}
          />
          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            style={{
              ...s.formInput,
              width: "auto",
              fontSize: "13px",
              padding: "6px 10px",
            }}
          >
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <button style={s.btnRefresh} onClick={cargar}>
            Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={s.kpiGrid}>
        {[
          {
            label: "Ventas del día",
            valor: `$${data.totalDia.toLocaleString()}`,
            sub: `${data.cantidadPedidos} pedidos`,
            color: tema.gold,
          },
          {
            label: "Ganancia estimada",
            valor: `$${data.gananciaEstimada.toLocaleString()}`,
            sub: `${data.totalDia > 0 ? Math.round((data.gananciaEstimada / data.totalDia) * 100) : 0}% margen`,
            color: tema.accent,
          },
          {
            label: "Pedidos activos",
            valor: `${data.pedidosActivos}`,
            sub: "en este momento",
            color: tema.verde,
          },
          {
            label: "Stock bajo",
            valor: `${data.stockBajo.length}`,
            sub: "productos a reponer",
            color: data.stockBajo.length > 0 ? tema.alertaText : tema.verde,
          },
          {
            label: "Ticket promedio",
            valor: `$${data.cantidadPedidos > 0 ? Math.round(data.totalDia / data.cantidadPedidos).toLocaleString() : 0}`,
            sub: "por pedido",
            color: "#85B7EB",
          },
          {
            label: "Ganancia total",
            valor: `$${margenTotal.toLocaleString()}`,
            sub: "sobre costo",
            color: tema.verde,
          },
        ].map((k, i) => (
          <div
            key={i}
            style={{ ...s.kpiCard, borderTop: `3px solid ${k.color}` }}
          >
            <div style={s.kpiLabel}>{k.label}</div>
            <div style={{ ...s.kpiValor, color: k.color }}>{k.valor}</div>
            <div style={s.kpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Alerta stock */}
      {data.stockBajo.length > 0 && (
        <div style={s.alertaBox}>
          <div style={s.alertaTitulo}>⚠ Reponer urgente</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {data.stockBajo.map((p) => (
              <div key={p.id} style={s.alertaChip}>
                <span style={{ fontWeight: "700" }}>{p.nombre}</span>
                <span style={{ opacity: 0.8, fontSize: "11px" }}>
                  {" "}
                  — {p.stockActual}/{p.stockMinimo} mín.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fila 1: barras hora + barras horizontales productos */}
      {(data.ventasPorHora.length > 0 || data.topProductos.length > 0) && (
        <div style={s.graficosRow}>
          {data.ventasPorHora.length > 0 && (
            <div style={{ ...s.card, flex: "2 1 380px" }}>
              <div style={s.cardHeader}>
                <h3 style={s.cardTitulo}>Ventas por hora</h3>
                <span style={s.cardSubtitulo}>
                  Pico:{" "}
                  {
                    data.ventasPorHora.reduce(
                      (mx, v) => (v.total > mx.total ? v : mx),
                      data.ventasPorHora[0],
                    )?.hora
                  }
                  h
                </span>
              </div>
              <div style={s.barChart}>
                {data.ventasPorHora.map((v, i) => {
                  const altura = maxHora > 0 ? (v.total / maxHora) * 100 : 0;
                  const esPico = v.total === maxHora && maxHora > 0;
                  return (
                    <div key={i} style={s.barCol}>
                      <div style={s.barLabelTop}>
                        {v.total > 0 ? `$${(v.total / 1000).toFixed(1)}k` : ""}
                      </div>
                      <div style={s.barWrapper}>
                        <div
                          style={{
                            ...s.bar,
                            height: `${Math.max(altura, v.total > 0 ? 4 : 0)}%`,
                            background: esPico
                              ? `linear-gradient(to top, ${tema.accent}, ${tema.gold})`
                              : tema.gold,
                            opacity: esPico ? 1 : 0.4,
                            boxShadow: esPico
                              ? `0 0 8px ${tema.gold}60`
                              : "none",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          ...s.barLabelBot,
                          color: esPico ? tema.gold : tema.textFaded,
                          fontWeight: esPico ? "700" : "400",
                        }}
                      >
                        {v.hora}h
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.topProductos.length > 0 && (
            <div style={{ ...s.card, flex: "1 1 260px" }}>
              <div style={s.cardHeader}>
                <h3 style={s.cardTitulo}>Top productos</h3>
                <span style={s.cardSubtitulo}>
                  {new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginTop: "4px",
                }}
              >
                {data.topProductos.slice(0, 6).map((p, i) => {
                  const pct =
                    maxProducto > 0 ? (p.total / maxProducto) * 100 : 0;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "13px",
                        }}
                      >
                        <span
                          style={{
                            color: tema.text,
                            fontWeight: "600",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "58%",
                          }}
                        >
                          {p.nombre}
                        </span>
                        <span
                          style={{
                            color: COLORES_TOP[i] || tema.gold,
                            fontWeight: "800",
                            fontSize: "12px",
                          }}
                        >
                          {p.cantidad} ud · ${p.total.toLocaleString()}
                        </span>
                      </div>
                      <div
                        style={{
                          height: "6px",
                          borderRadius: "4px",
                          background: `${tema.gold}20`,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            borderRadius: "4px",
                            background: COLORES_TOP[i] || tema.gold,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                      {p.margen !== undefined && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: p.margen >= 0 ? tema.verde : tema.alertaText,
                          }}
                        >
                          margen +${p.margen.toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fila 2: donut pago + stats rendimiento */}
      {(data.porMetodoPago?.length > 0 || data.topProductos.length > 0) && (
        <div style={s.graficosRow}>
          {data.porMetodoPago?.length > 0 && (
            <div style={{ ...s.card, flex: "1 1 240px" }}>
              <div style={s.cardHeader}>
                <h3 style={s.cardTitulo}>Métodos de pago</h3>
                <span style={s.cardSubtitulo}>
                  ${totalMetodos.toLocaleString()} total
                </span>
              </div>
              <DonutChart
                data={data.porMetodoPago}
                total={totalMetodos}
                colores={COLORES_METODO}
                tema={tema}
              />
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {data.porMetodoPago.map((m, i) => {
                  const pct =
                    totalMetodos > 0
                      ? Math.round((m.total / totalMetodos) * 100)
                      : 0;
                  const color = COLORES_METODO[m.metodo] || tema.gold;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          background: color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{ flex: 1, fontSize: "13px", color: tema.text }}
                      >
                        {m.metodo}
                      </span>
                      <span style={{ fontSize: "12px", color: tema.textFaded }}>
                        {m.pedidos} ped.
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                          color,
                          minWidth: "38px",
                          textAlign: "right",
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.topProductos.length > 0 && (
            <div style={{ ...s.card, flex: "2 1 340px" }}>
              <div style={s.cardHeader}>
                <h3 style={s.cardTitulo}>Rendimiento del día</h3>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div style={s.statBox}>
                  <div style={s.statLabel}>🏆 Producto estrella</div>
                  <div style={{ ...s.statValor, color: tema.gold }}>
                    {data.topProductos[0]?.nombre || "—"}
                  </div>
                  <div style={s.statSub}>
                    {data.topProductos[0]?.cantidad || 0} unidades
                  </div>
                </div>
                {margenTotal > 0 && (
                  <div style={s.statBox}>
                    <div style={s.statLabel}>💰 Mayor margen</div>
                    <div style={{ ...s.statValor, color: tema.verde }}>
                      {[...data.topProductos].sort(
                        (a, b) => (b.margen || 0) - (a.margen || 0),
                      )[0]?.nombre || "—"}
                    </div>
                    <div style={s.statSub}>
                      +$
                      {[...data.topProductos]
                        .sort((a, b) => (b.margen || 0) - (a.margen || 0))[0]
                        ?.margen?.toLocaleString() || 0}
                    </div>
                  </div>
                )}
                {data.ventasPorHora.length > 0 && (
                  <div style={s.statBox}>
                    <div style={s.statLabel}>⏰ Hora pico</div>
                    <div style={{ ...s.statValor, color: tema.accent }}>
                      {
                        data.ventasPorHora.reduce(
                          (mx, v) => (v.total > mx.total ? v : mx),
                          data.ventasPorHora[0],
                        )?.hora
                      }
                      :00h
                    </div>
                    <div style={s.statSub}>
                      $
                      {data.ventasPorHora
                        .reduce(
                          (mx, v) => (v.total > mx.total ? v : mx),
                          data.ventasPorHora[0],
                        )
                        ?.total?.toLocaleString()}{" "}
                      esa hora
                    </div>
                  </div>
                )}
                <div style={s.statBox}>
                  <div style={s.statLabel}>📈 Margen neto</div>
                  <div
                    style={{
                      ...s.statValor,
                      color: margenTotal > 0 ? tema.verde : tema.textFaded,
                    }}
                  >
                    {data.totalDia > 0
                      ? Math.round((margenTotal / data.totalDia) * 100)
                      : 0}
                    %
                  </div>
                  <div style={s.statSub}>sobre ventas totales</div>
                </div>
              </div>

              <div
                style={{
                  borderTop: `1px solid ${tema.separador}`,
                  paddingTop: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: tema.textFaded,
                    fontWeight: "700",
                    marginBottom: "8px",
                    letterSpacing: "0.5px",
                  }}
                >
                  DETALLE TOP PRODUCTOS
                </div>
                {data.topProductos.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "5px 0",
                      borderBottom: `1px solid ${tema.separador}`,
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: COLORES_TOP[i] || tema.textFaded,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: "13px",
                        color: tema.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.nombre}
                    </span>
                    <span style={{ fontSize: "12px", color: tema.textFaded }}>
                      {p.cantidad} ud
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: COLORES_TOP[i] || tema.gold,
                        minWidth: "70px",
                        textAlign: "right",
                      }}
                    >
                      ${p.total.toLocaleString()}
                    </span>
                    {p.margen !== undefined && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: p.margen >= 0 ? tema.verde : tema.alertaText,
                          minWidth: "60px",
                          textAlign: "right",
                        }}
                      >
                        +${p.margen.toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
                {margenTotal > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      paddingTop: "8px",
                      fontSize: "14px",
                      fontWeight: "800",
                      color: tema.verde,
                    }}
                  >
                    Ganancia total: +${margenTotal.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {data.cantidadPedidos === 0 && (
        <div style={s.vacio}>Sin ventas para esta fecha</div>
      )}
    </div>
  );
}

// ─── DONUT CHART SVG ──────────────────────────────────────────

function DonutChart({ data, total, colores, tema }) {
  if (!data || data.length === 0 || total === 0) return null;
  const radio = 50,
    grosor = 16,
    cx = 65,
    cy = 65;
  const circ = 2 * Math.PI * radio;
  let acum = 0;
  const segs = data.map((m) => {
    const pct = m.total / total;
    const offset = circ * (1 - pct);
    const rot = acum * 360;
    acum += pct;
    return { ...m, offset, rot };
  });
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle
          cx={cx}
          cy={cy}
          r={radio}
          fill="none"
          stroke={`${tema.gold}18`}
          strokeWidth={grosor}
        />
        {segs.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radio}
            fill="none"
            stroke={colores[seg.metodo] || tema.gold}
            strokeWidth={grosor}
            strokeDasharray={circ}
            strokeDashoffset={seg.offset}
            strokeLinecap="round"
            transform={`rotate(${seg.rot - 90} ${cx} ${cy})`}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        ))}
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          fill={tema.gold}
          fontSize="12"
          fontWeight="800"
        >
          ${(total / 1000).toFixed(1)}k
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill={tema.textFaded}
          fontSize="9"
        >
          total
        </text>
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
  const [form, setForm] = useState({
    categoriaId: "",
    nombre: "",
    descripcion: "",
    precio: "",
    precioCosto: "",
    stockActual: "",
    stockMinimo: "5",
    tiempoPreparacion: "",
    imagenUrl: "",
    disponible: true,
  });

  const cargar = useCallback(() => {
    api.get("/admin/productos").then((r) => setProductos(r.data));
    api.get("/admin/categorias").then((r) => setCategorias(r.data));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirNuevo = () => {
    setForm({
      categoriaId: categorias[0]?.id || "",
      nombre: "",
      descripcion: "",
      precio: "",
      precioCosto: "",
      stockActual: "0",
      stockMinimo: "5",
      tiempoPreparacion: "",
      imagenUrl: "",
      disponible: true,
    });
    setProductoEditar(null);
    setMostrando("nuevo");
  };
  const abrirEditar = (p) => {
    setForm({
      categoriaId: p.categoriaId,
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precio: p.precio,
      precioCosto: p.precioCosto || "",
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
      tiempoPreparacion: p.tiempoPreparacion || "",
      imagenUrl: p.imagenUrl || "",
      disponible: p.disponible,
    });
    setProductoEditar(p);
    setMostrando("editar");
  };
  const guardar = async () => {
    try {
      if (productoEditar)
        await api.put(`/admin/productos/${productoEditar.id}`, form);
      else await api.post("/admin/productos", form);
      cargar();
      setMostrando("lista");
    } catch {
      alert("Error al guardar producto");
    }
  };
  const toggleDisponible = async (p) => {
    await api.put(`/admin/productos/${p.id}`, { disponible: !p.disponible });
    cargar();
  };

  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria?.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  if (mostrando !== "lista") {
    return (
      <div style={s.seccion}>
        <div style={s.seccionHeader}>
          <h2 style={s.seccionTitulo}>
            {productoEditar ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button style={s.btnSecundario} onClick={() => setMostrando("lista")}>
            Cancelar
          </button>
        </div>
        <div style={s.card}>
          <div className="admin-form-grid" style={s.formGrid}>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Categoría</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  style={{ ...s.formInput, flex: 1 }}
                  value={form.categoriaId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoriaId: e.target.value }))
                  }
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icono} {c.nombre}
                    </option>
                  ))}
                </select>
                <button
                  style={{
                    ...s.btnSecundario,
                    padding: "8px 12px",
                    fontSize: "13px",
                    whiteSpace: "nowrap",
                  }}
                  onClick={async () => {
                    const nombre = prompt("Nombre de la nueva categoría:");
                    if (!nombre) return;
                    const icono = prompt("Emoji o ícono (opcional):") || "";
                    await api.post("/categorias/nueva", { nombre, icono });
                    api
                      .get("/admin/categorias")
                      .then((r) => setCategorias(r.data));
                  }}
                >
                  + Nueva
                </button>
              </div>
            </div>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Nombre</label>
              <input
                style={s.formInput}
                value={form.nombre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre: e.target.value }))
                }
              />
            </div>
            <div style={{ ...s.formGrupo, gridColumn: "1/-1" }}>
              <label style={s.formLabel}>Descripción</label>
              <textarea
                style={{ ...s.formInput, resize: "none" }}
                rows={2}
                value={form.descripcion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descripcion: e.target.value }))
                }
              />
            </div>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Precio de venta</label>
              <input
                style={s.formInput}
                type="number"
                value={form.precio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, precio: e.target.value }))
                }
              />
            </div>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Precio de costo</label>
              <input
                style={s.formInput}
                type="number"
                value={form.precioCosto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, precioCosto: e.target.value }))
                }
              />
            </div>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Stock inicial</label>
              <input
                style={s.formInput}
                type="number"
                value={form.stockActual}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stockActual: e.target.value }))
                }
              />
            </div>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Stock mínimo (alerta)</label>
              <input
                style={s.formInput}
                type="number"
                value={form.stockMinimo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, stockMinimo: e.target.value }))
                }
              />
            </div>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Tiempo preparación (min)</label>
              <input
                style={s.formInput}
                type="number"
                value={form.tiempoPreparacion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tiempoPreparacion: e.target.value }))
                }
              />
            </div>
            <div style={s.formGrupo}>
              <label style={s.formLabel}>URL de imagen</label>
              <input
                style={s.formInput}
                value={form.imagenUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imagenUrl: e.target.value }))
                }
              />
            </div>
            <div style={{ ...s.formGrupo, gridColumn: "1/-1" }}>
              <label style={s.checkLabel}>
                <input
                  type="checkbox"
                  checked={form.disponible}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, disponible: e.target.checked }))
                  }
                />
                Disponible en el menú
              </label>
            </div>
          </div>
          <button style={s.btnPrimario} onClick={guardar}>
            {productoEditar ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>Productos ({productos.length})</h2>
        <button style={s.btnPrimario} onClick={abrirNuevo}>
          + Nuevo
        </button>
      </div>
      <input
        type="text"
        placeholder="Buscar producto o categoría..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ ...s.formInput, marginBottom: "8px" }}
      />
      <div style={s.listaAdmin}>
        {productosFiltrados.map((p) => (
          <div
            key={p.id}
            style={{ ...s.listaItem, opacity: p.disponible ? 1 : 0.5 }}
          >
            <div style={s.listaItemInfo}>
              <div style={s.listaItemNombre}>{p.nombre}</div>
              <div style={s.listaItemSub}>
                {p.categoria?.nombre} · ${Number(p.precio).toLocaleString()}
                {p.precioCosto &&
                  ` · Margen: $${(Number(p.precio) - Number(p.precioCosto)).toLocaleString()}`}
              </div>
            </div>
            <div style={s.listaItemAcciones}>
              <span
                style={{
                  ...s.stockPill,
                  background:
                    p.stockActual <= p.stockMinimo
                      ? tema.alertaBg
                      : tema.verdeBg,
                  color:
                    p.stockActual <= p.stockMinimo
                      ? tema.alertaText
                      : tema.verde,
                }}
              >
                {p.stockActual} ud.
              </span>
              <button style={s.btnIcono} onClick={() => abrirEditar(p)}>
                Editar
              </button>
              <button
                style={{
                  ...s.btnIcono,
                  color: p.disponible ? tema.alertaText : tema.verde,
                }}
                onClick={() => toggleDisponible(p)}
              >
                {p.disponible ? "Pausar" : "Activar"}
              </button>
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

  const cargar = useCallback(() => {
    api.get("/admin/productos").then((r) => {
      setProductos(r.data);
      const ini = {};
      r.data.forEach((p) => {
        ini[p.id] = "";
      });
      setCantidades(ini);
    });
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregarStock = async (p) => {
    const cantidad = Number(cantidades[p.id]);
    if (!cantidad || cantidad <= 0) return;
    setGuardando((prev) => ({ ...prev, [p.id]: true }));
    try {
      await api.patch(`/admin/productos/${p.id}/stock`, {
        cantidad,
        operacion: "agregar",
      });
      setCantidades((prev) => ({ ...prev, [p.id]: "" }));
      cargar();
    } catch {
      alert("Error al actualizar stock");
    } finally {
      setGuardando((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  const filtrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.categoria?.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );
  const bajos = filtrados.filter((p) => p.stockActual <= p.stockMinimo);
  const normales = filtrados.filter((p) => p.stockActual > p.stockMinimo);

  const StockRow = ({ p, primario }) => (
    <div style={s.stockRow}>
      <div style={s.stockInfo}>
        <span style={s.stockNombre}>{p.nombre}</span>
        <span style={primario ? s.stockActualBajo : s.stockActualOk}>
          {primario
            ? `${p.stockActual} ud. (mín: ${p.stockMinimo})`
            : `${p.stockActual} ud. disponibles`}
        </span>
      </div>
      <div style={s.stockAccion}>
        <input
          type="number"
          placeholder="+ cant."
          min="1"
          value={cantidades[p.id] || ""}
          onChange={(e) =>
            setCantidades((prev) => ({ ...prev, [p.id]: e.target.value }))
          }
          style={s.stockInput}
        />
        <button
          style={{
            ...(primario ? s.btnPrimario : s.btnSecundario),
            padding: "8px 14px",
            fontSize: "13px",
          }}
          onClick={() => agregarStock(p)}
          disabled={guardando[p.id]}
        >
          {guardando[p.id] ? "..." : "Agregar"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>Control de stock</h2>
        <button style={s.btnRefresh} onClick={cargar}>
          Actualizar
        </button>
      </div>
      <input
        type="text"
        placeholder="Buscar producto o categoría..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ ...s.formInput, marginBottom: "8px" }}
      />
      {bajos.length > 0 && (
        <div style={s.alertaBox}>
          <div style={s.alertaTitulo}>Requieren reposición urgente</div>
          {bajos.map((p) => (
            <StockRow key={p.id} p={p} primario />
          ))}
        </div>
      )}
      <div style={s.card}>
        <h3 style={s.cardTitulo}>Todos los productos</h3>
        {normales.map((p) => (
          <StockRow key={p.id} p={p} primario={false} />
        ))}
      </div>
    </div>
  );
}

// ─── USUARIOS ─────────────────────────────────────────────────

function Usuarios({ tema }) {
  const s = getStyles(tema);
  const [usuarios, setUsuarios] = useState([]);
  const [mostrando, setMostrando] = useState("lista");
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    rol: "EMPLEADO",
  });
  const ROLES = { DUEÑO: "Dueño", EMPLEADO: "Empleado", COCINA: "Cocina" };

  const cargar = useCallback(() => {
    api.get("/admin/usuarios").then((r) => setUsuarios(r.data));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async () => {
    try {
      await api.post("/admin/usuarios", form);
      cargar();
      setMostrando("lista");
      setForm({ nombre: "", email: "", password: "", rol: "EMPLEADO" });
    } catch (e) {
      alert(e.response?.data?.error || "Error al crear usuario");
    }
  };
  const toggle = async (id) => {
    await api.patch(`/admin/usuarios/${id}/toggle`);
    cargar();
  };

  if (mostrando === "nuevo") {
    return (
      <div style={s.seccion}>
        <div style={s.seccionHeader}>
          <h2 style={s.seccionTitulo}>Nuevo usuario</h2>
          <button style={s.btnSecundario} onClick={() => setMostrando("lista")}>
            Cancelar
          </button>
        </div>
        <div style={s.card}>
          <div className="admin-form-grid" style={s.formGrid}>
            {[
              ["nombre", "Nombre completo", "text"],
              ["email", "Email", "email"],
              ["password", "Contraseña", "password"],
            ].map(([key, label, type]) => (
              <div key={key} style={s.formGrupo}>
                <label style={s.formLabel}>{label}</label>
                <input
                  style={s.formInput}
                  type={type}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <div style={s.formGrupo}>
              <label style={s.formLabel}>Rol</label>
              <select
                style={s.formInput}
                value={form.rol}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rol: e.target.value }))
                }
              >
                <option value="EMPLEADO">Empleado</option>
                <option value="COCINA">Cocina</option>
                <option value="DUEÑO">Dueño</option>
              </select>
            </div>
          </div>
          <button style={s.btnPrimario} onClick={crear}>
            Crear usuario
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>Usuarios ({usuarios.length})</h2>
        <button style={s.btnPrimario} onClick={() => setMostrando("nuevo")}>
          + Nuevo
        </button>
      </div>
      <div style={s.listaAdmin}>
        {usuarios.map((u) => (
          <div
            key={u.id}
            style={{ ...s.listaItem, opacity: u.activo ? 1 : 0.5 }}
          >
            <div style={s.listaItemInfo}>
              <div style={s.listaItemNombre}>{u.nombre}</div>
              <div style={s.listaItemSub}>
                {u.email} · {ROLES[u.rol]}
              </div>
            </div>
            <div style={s.listaItemAcciones}>
              <span
                style={{
                  ...s.stockPill,
                  background: u.activo ? tema.verdeBg : tema.bgLight,
                  color: u.activo ? tema.verde : tema.textFaded,
                }}
              >
                {u.activo ? "Activo" : "Inactivo"}
              </span>
              <button
                style={{
                  ...s.btnIcono,
                  color: u.activo ? tema.alertaText : tema.verde,
                }}
                onClick={() => toggle(u.id)}
              >
                {u.activo ? "Desactivar" : "Activar"}
              </button>
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
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [productos, setProductos] = useState([]);
  const [filtros, setFiltros] = useState({
    desde: new Date().toISOString().split("T")[0],
    hasta: new Date().toISOString().split("T")[0],
    productoId: "",
  });
  const [ticketAbierto, setTicketAbierto] = useState(null);
  const [razonSocial] = useState({
    nombre: localStorage.getItem("rs_nombre") || "HaceCafe",
    subtitulo:
      localStorage.getItem("rs_subtitulo") || "Cafetería & Cocina Artesanal",
    direccion: localStorage.getItem("rs_direccion") || "",
    telefono: localStorage.getItem("rs_telefono") || "",
    cuit: localStorage.getItem("rs_cuit") || "",
  });

  const cargar = useCallback(() => {
    setCargando(true);
    const p = new URLSearchParams();
    if (filtros.desde) p.append("desde", filtros.desde);
    if (filtros.hasta) p.append("hasta", filtros.hasta);
    if (filtros.productoId) p.append("productoId", filtros.productoId);
    api
      .get(`/admin/caja?${p.toString()}`)
      .then((r) => setData(r.data))
      .finally(() => setCargando(false));
  }, [filtros]);

  useEffect(() => {
    api.get("/admin/productos").then((r) => setProductos(r.data));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const exportarExcel = () => {
    if (!data || data.pedidos.length === 0) return;
    import("xlsx").then((XLSX) => {
      const filas = data.pedidos.flatMap((pedido) =>
        pedido.items.map((item) => ({
          "Pedido #": pedido.numero,
          Fecha: new Date(pedido.actualizadoEn).toLocaleDateString("es-AR"),
          Hora: new Date(pedido.actualizadoEn).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          Mesa: pedido.mesa || "-",
          Producto: item.producto.nombre,
          Cantidad: item.cantidad,
          "Precio unit.": Number(item.precioUnit),
          Subtotal: Number(item.subtotal),
          "Total pedido": Number(pedido.total),
          "Método de pago": pedido.metodoPago || "EFECTIVO",
          Vendedor: pedido.usuario?.nombre || "Sistema",
        })),
      );
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filas);
      ws["!cols"] = [
        { wch: 10 },
        { wch: 12 },
        { wch: 8 },
        { wch: 8 },
        { wch: 25 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, "Detalle ventas");
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          data.porVendedor.map((v) => ({
            Vendedor: v.nombre,
            Pedidos: v.pedidos,
            "Total vendido": v.total,
          })),
        ),
        "Por vendedor",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          (data.porMetodoPago || []).map((m) => ({
            Método: m.metodo,
            Pedidos: m.pedidos,
            Total: m.total,
          })),
        ),
        "Por método",
      );
      XLSX.writeFile(
        wb,
        `hacecafe_caja_${filtros.desde}_${filtros.hasta}.xlsx`,
      );
    });
  };

  if (cargando) return <div style={s.cargando}>Cargando caja...</div>;

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>Caja</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={s.btnRefresh} onClick={cargar}>
            Actualizar
          </button>
          {data?.pedidos.length > 0 && (
            <button style={s.btnPrimario} onClick={exportarExcel}>
              Exportar Excel
            </button>
          )}
        </div>
      </div>
      <div style={s.card}>
        <h3 style={s.cardTitulo}>Filtros</h3>
        <div className="admin-form-grid" style={{ ...s.formGrid, gap: "10px" }}>
          <div style={s.formGrupo}>
            <label style={s.formLabel}>Desde</label>
            <input
              type="date"
              style={s.formInput}
              value={filtros.desde}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, desde: e.target.value }))
              }
            />
          </div>
          <div style={s.formGrupo}>
            <label style={s.formLabel}>Hasta</label>
            <input
              type="date"
              style={s.formInput}
              value={filtros.hasta}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, hasta: e.target.value }))
              }
            />
          </div>
          <div style={{ ...s.formGrupo, gridColumn: "1/-1" }}>
            <label style={s.formLabel}>Producto (opcional)</label>
            <select
              style={s.formInput}
              value={filtros.productoId}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, productoId: e.target.value }))
              }
            >
              <option value="">Todos</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {data && (
        <>
          <div style={s.kpiGrid}>
            <div style={{ ...s.kpiCard, borderTop: `3px solid ${tema.gold}` }}>
              <div style={s.kpiLabel}>Total del período</div>
              <div style={s.kpiValor}>${data.total.toLocaleString()}</div>
              <div style={s.kpiSub}>
                {filtros.desde === filtros.hasta
                  ? "hoy"
                  : `${filtros.desde} → ${filtros.hasta}`}
              </div>
            </div>
            <div
              style={{ ...s.kpiCard, borderTop: `3px solid ${tema.accent}` }}
            >
              <div style={s.kpiLabel}>Transacciones</div>
              <div style={{ ...s.kpiValor, color: tema.accent }}>
                {data.cantidad}
              </div>
              <div style={s.kpiSub}>pedidos cobrados</div>
            </div>
            <div style={{ ...s.kpiCard, borderTop: `3px solid ${tema.verde}` }}>
              <div style={s.kpiLabel}>Ticket promedio</div>
              <div style={{ ...s.kpiValor, color: tema.verde }}>
                $
                {data.cantidad > 0
                  ? Math.round(data.total / data.cantidad).toLocaleString()
                  : 0}
              </div>
              <div style={s.kpiSub}>por pedido</div>
            </div>
          </div>
          {data.porMetodoPago?.length > 0 && (
            <div style={s.card}>
              <h3 style={s.cardTitulo}>Por método de pago</h3>
              {data.porMetodoPago.map((m, i) => (
                <div key={i} style={s.rankRow}>
                  <div
                    style={{
                      ...s.rankIndicador,
                      background:
                        m.metodo === "EFECTIVO"
                          ? tema.verde
                          : m.metodo === "QR"
                            ? tema.accent
                            : tema.gold,
                    }}
                  />
                  <span style={s.rankNombre}>{m.metodo}</span>
                  <span style={s.rankCantidad}>{m.pedidos} pedidos</span>
                  <span style={s.rankTotal}>${m.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          {data.porVendedor.length > 0 && (
            <div style={s.card}>
              <h3 style={s.cardTitulo}>Ventas por empleado</h3>
              {data.porVendedor
                .sort((a, b) => b.total - a.total)
                .map((v, i) => (
                  <div key={i} style={s.rankRow}>
                    <div
                      style={{
                        ...s.rankIndicador,
                        background: i === 0 ? tema.gold : tema.textFaded,
                      }}
                    />
                    <span style={s.rankNombre}>{v.nombre}</span>
                    <span style={s.rankCantidad}>{v.pedidos} pedidos</span>
                    <span style={s.rankTotal}>${v.total.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          )}
          {data.pedidos.length === 0 ? (
            <div style={s.vacio}>Sin ventas para este período</div>
          ) : (
            <div style={s.card}>
              <h3 style={s.cardTitulo}>
                Detalle de pedidos ({data.pedidos.length})
              </h3>
              {ticketAbierto && (
                <Ticket
                  pedido={ticketAbierto}
                  razonSocial={razonSocial}
                  onCerrar={() => setTicketAbierto(null)}
                />
              )}
              {data.pedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  style={{
                    ...s.cajaRow,
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={s.cajaInfo}>
                      <span style={s.cajaNombre}>Pedido #{pedido.numero}</span>
                      <span style={s.cajaSub}>
                        {new Date(pedido.actualizadoEn).toLocaleDateString(
                          "es-AR",
                        )}{" "}
                        {new Date(pedido.actualizadoEn).toLocaleTimeString(
                          "es-AR",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                        {pedido.mesa ? ` · Mesa ${pedido.mesa}` : ""}
                        {pedido.usuario ? ` · ${pedido.usuario.nombre}` : ""}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span style={s.cajaTotal}>
                        ${Number(pedido.total).toLocaleString()}
                      </span>
                      <button
                        style={{
                          ...s.btnIcono,
                          border: `1px solid ${tema.borderFaded}`,
                          borderRadius: "8px",
                          padding: "5px 10px",
                        }}
                        onClick={() => setTicketAbierto(pedido)}
                      >
                        Ticket
                      </button>
                    </div>
                  </div>
                  <div style={{ width: "100%" }}>
                    {pedido.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          color: tema.textFaded,
                          padding: "2px 0",
                        }}
                      >
                        <span>
                          {item.cantidad}x {item.producto.nombre}
                        </span>
                        <span>${Number(item.subtotal).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
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
  const EMOJIS = [
    "☕",
    "🥐",
    "🧃",
    "🍰",
    "🥪",
    "🍵",
    "🧋",
    "🍹",
    "🥤",
    "🍫",
    "🥗",
    "🍕",
    "🧆",
    "🥞",
    "🍳",
    "🫖",
    "🍺",
    "🥂",
    "🎂",
    "🍦",
  ];

  const cargar = useCallback(() => {
    api.get("/admin/categorias").then((r) => setCategorias(r.data));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarEdicion = async (cat) => {
    await api.patch(`/admin/categorias/${cat.id}`, cat);
    setEditando(null);
    cargar();
  };
  const toggleActiva = async (cat) => {
    await api.patch(`/admin/categorias/${cat.id}`, { activa: !cat.activa });
    cargar();
  };

  const moverOrden = async (cat, dir) => {
    const ord = [...categorias].sort(
      (a, b) => (a.ordenDisplay ?? 999) - (b.ordenDisplay ?? 999),
    );
    const idx = ord.findIndex((c) => c.id === cat.id);
    const idxD = idx + dir;
    if (idxD < 0 || idxD >= ord.length) return;
    const dest = ord[idxD];
    const oA = cat.ordenDisplay ?? idx + 1,
      oB = dest.ordenDisplay ?? idxD + 1;
    setCategorias((prev) =>
      prev
        .map((c) =>
          c.id === cat.id
            ? { ...c, ordenDisplay: oB }
            : c.id === dest.id
              ? { ...c, ordenDisplay: oA }
              : c,
        )
        .sort((a, b) => (a.ordenDisplay ?? 999) - (b.ordenDisplay ?? 999)),
    );
    await api.patch(`/admin/categorias/${cat.id}`, { ordenDisplay: oB });
    await api.patch(`/admin/categorias/${dest.id}`, { ordenDisplay: oA });
  };

  const crearNueva = async () => {
    if (!nueva.nombre.trim()) return;
    await api.post("/admin/categorias", nueva);
    setNueva({ nombre: "", icono: "" });
    setMostrando("lista");
    cargar();
  };

  if (mostrando === "nueva") {
    return (
      <div style={s.seccion}>
        <div style={s.seccionHeader}>
          <h2 style={s.seccionTitulo}>Nueva categoría</h2>
          <button style={s.btnSecundario} onClick={() => setMostrando("lista")}>
            Cancelar
          </button>
        </div>
        <div style={s.card}>
          <div style={s.formGrupo}>
            <label style={s.formLabel}>Nombre</label>
            <input
              style={s.formInput}
              value={nueva.nombre}
              onChange={(e) =>
                setNueva((n) => ({ ...n, nombre: e.target.value }))
              }
              placeholder="Ej: Licuados"
            />
          </div>
          <div style={s.formGrupo}>
            <label style={s.formLabel}>Emoji</label>
            <input
              style={s.formInput}
              value={nueva.icono}
              onChange={(e) =>
                setNueva((n) => ({ ...n, icono: e.target.value }))
              }
              placeholder="Pegá un emoji"
            />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  style={{
                    fontSize: "22px",
                    background:
                      nueva.icono === e ? tema.bgLight : "transparent",
                    border: `1px solid ${tema.borderFaded}`,
                    borderRadius: "8px",
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                  onClick={() => setNueva((n) => ({ ...n, icono: e }))}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <button style={s.btnPrimario} onClick={crearNueva}>
            Crear categoría
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>Categorías ({categorias.length})</h2>
        <button style={s.btnPrimario} onClick={() => setMostrando("nueva")}>
          + Nueva
        </button>
      </div>
      <p style={{ fontSize: "13px", color: tema.textFaded, margin: 0 }}>
        Usá las flechas para cambiar el orden en el menú del cliente y la
        pantalla del empleado.
      </p>
      <div style={s.listaAdmin}>
        {categorias.map((cat, idx) => (
          <div
            key={cat.id}
            style={{ ...s.listaItem, opacity: cat.activa ? 1 : 0.5 }}
          >
            {editando?.id === cat.id ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: "22px" }}>{editando.icono}</span>
                <input
                  style={{ ...s.formInput, flex: 1, minWidth: "120px" }}
                  value={editando.nombre}
                  onChange={(e) =>
                    setEditando((ed) => ({ ...ed, nombre: e.target.value }))
                  }
                />
                <input
                  style={{ ...s.formInput, width: "80px" }}
                  value={editando.icono}
                  placeholder="Emoji"
                  onChange={(e) =>
                    setEditando((ed) => ({ ...ed, icono: e.target.value }))
                  }
                />
                <button
                  style={s.btnPrimario}
                  onClick={() => guardarEdicion(editando)}
                >
                  Guardar
                </button>
                <button
                  style={s.btnSecundario}
                  onClick={() => setEditando(null)}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <div style={s.listaItemInfo}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "22px" }}>{cat.icono}</span>
                    <div>
                      <div style={s.listaItemNombre}>{cat.nombre}</div>
                      <div style={s.listaItemSub}>
                        Orden: {cat.ordenDisplay ?? idx + 1}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={s.listaItemAcciones}>
                  <button
                    style={{ ...s.btnIcono, fontSize: "16px" }}
                    onClick={() => moverOrden(cat, -1)}
                  >
                    ↑
                  </button>
                  <button
                    style={{ ...s.btnIcono, fontSize: "16px" }}
                    onClick={() => moverOrden(cat, 1)}
                  >
                    ↓
                  </button>
                  <button
                    style={s.btnIcono}
                    onClick={() => setEditando({ ...cat })}
                  >
                    Editar
                  </button>
                  <button
                    style={{
                      ...s.btnIcono,
                      color: cat.activa ? tema.alertaText : tema.verde,
                    }}
                    onClick={() => toggleActiva(cat)}
                  >
                    {cat.activa ? "Ocultar" : "Mostrar"}
                  </button>
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

  // Persiste en localStorage igual que Config.
  const [cantidadMesas, setCantidadMesas] = useState(() =>
    parseInt(localStorage.getItem("rs_mesas") || "7"),
  );
  const nombreLocal = localStorage.getItem("rs_nombre") || "HaceCafe";
  const dominio = localStorage.getItem("rs_dominio") || window.location.origin;

  const cambiarCantidad = (n) => {
    const val = Math.max(1, Math.min(99, n));
    setCantidadMesas(val);
    localStorage.setItem("rs_mesas", String(val));
  };

  const mesas = Array.from({ length: cantidadMesas }, (_, i) => i + 1);

  const descargarSVG = (nMesa) => {
    const svg = document.getElementById(`qr-mesa-${nMesa}`);
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-mesa-${nMesa}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const imprimirUna = (nMesa) => {
    const w = window.open("", "_blank");
    w.document
      .write(`<html><head><title>QR Mesa ${nMesa} — ${nombreLocal}</title>
    <style>body{font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff}
    .card{border:3px solid #333;border-radius:16px;padding:32px;text-align:center;width:280px}
    .local{font-size:12px;color:#888;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
    .mesa{font-size:32px;font-weight:900;color:#1a1a1a;margin-bottom:10px}
    .sep{width:50px;height:2px;background:#C8913A;margin:0 auto 16px}
    .inst{font-size:12px;color:#888;margin-top:14px}
    @media print{@page{margin:5mm}}</style></head>
    <body><div class="card">
      <div class="local">${nombreLocal}</div>
      <div class="mesa">Mesa ${nMesa}</div>
      <div class="sep"></div><div id="qr"></div>
      <div class="inst">Escaneá para hacer tu pedido</div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script>new QRCode(document.getElementById('qr'),{text:'${dominio}/menu?mesa=${nMesa}',width:200,height:200,colorDark:'#1a1a1a',colorLight:'#fff'});
    setTimeout(()=>window.print(),600)</script></body></html>`);
    w.document.close();
  };

  const imprimirTodos = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>QR Mesas — ${nombreLocal}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;background:#fff}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:20px}
    .qr-card{border:2px solid #333;border-radius:12px;padding:20px;text-align:center;break-inside:avoid}
    .local{font-size:13px;color:#666;margin-bottom:8px;letter-spacing:2px;text-transform:uppercase}
    .mesa{font-size:28px;font-weight:800;margin-bottom:12px;color:#1a1a1a}
    .sep{width:40px;height:2px;background:#C8913A;margin:8px auto}
    .inst{font-size:11px;color:#888;margin-top:10px}
    @media print{@page{margin:10mm}}</style></head>
    <body><div class="grid">
      ${mesas.map((n) => `<div class="qr-card"><div class="local">${nombreLocal}</div><div class="mesa">Mesa ${n}</div><div class="sep"></div><div id="qr-${n}"></div><div class="inst">Escaneá para hacer tu pedido</div></div>`).join("")}
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script>
      ${mesas.map((n) => `new QRCode(document.getElementById('qr-${n}'),{text:'${dominio}/menu?mesa=${n}',width:160,height:160,colorDark:'#1a1a1a',colorLight:'#fff'});`).join("")}
      setTimeout(()=>window.print(),900)
    </script></body></html>`);
    w.document.close();
  };

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>QR por mesa</h2>
        <button style={s.btnPrimario} onClick={imprimirTodos}>
          🖨 Imprimir todos
        </button>
      </div>

      {/* Panel cantidad mesas */}
      <div style={s.card}>
        <h3 style={s.cardTitulo}>Cantidad de mesas</h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* Botones +/- */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              style={s.btnContador}
              onClick={() => cambiarCantidad(cantidadMesas - 1)}
              disabled={cantidadMesas <= 1}
            >
              −
            </button>
            <span
              style={{
                fontSize: "1.6rem",
                fontWeight: "900",
                color: tema.gold,
                minWidth: "42px",
                textAlign: "center",
              }}
            >
              {cantidadMesas}
            </span>
            <button
              style={{
                ...s.btnContador,
                background: tema.accent,
                color: tema.accentText,
                border: "none",
              }}
              onClick={() => cambiarCantidad(cantidadMesas + 1)}
            >
              +
            </button>
          </div>
          {/* Input directo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: tema.textFaded }}>
              o ingresá el número:
            </span>
            <input
              type="number"
              min="1"
              max="99"
              value={cantidadMesas}
              onChange={(e) => cambiarCantidad(parseInt(e.target.value) || 1)}
              style={{
                ...s.formInput,
                width: "72px",
                textAlign: "center",
                padding: "8px",
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: "12px", color: tema.textFaded }}>
          URL base: <strong style={{ color: tema.gold }}>{dominio}</strong>
          <span style={{ marginLeft: "8px", opacity: 0.6 }}>
            · cada QR apunta a {dominio}/menu?mesa=N
          </span>
        </div>
        <div style={{ fontSize: "11px", color: tema.textFaded, opacity: 0.6 }}>
          Tip: configurá el dominio de producción en{" "}
          <strong>Config. → Dominio del sistema</strong> antes de imprimir.
        </div>
      </div>

      {/* Grilla de QRs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
          gap: "14px",
        }}
      >
        {mesas.map((n) => (
          <div
            key={n}
            style={{
              ...s.card,
              alignItems: "center",
              textAlign: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: tema.textFaded,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              {nombreLocal}
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: "900",
                color: tema.gold,
                fontFamily: "Georgia, serif",
              }}
            >
              Mesa {n}
            </div>
            <div
              style={{
                width: "40px",
                height: "2px",
                background: tema.gold,
                borderRadius: "2px",
              }}
            />

            {/* QR SVG en blanco */}
            <div
              style={{
                background: "#fff",
                borderRadius: "10px",
                padding: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <QRCodeSVG
                id={`qr-mesa-${n}`}
                value={`${dominio}/menu?mesa=${n}`}
                size={140}
                bgColor="#ffffff"
                fgColor="#1a1a1a"
                level="M"
                includeMargin={false}
              />
            </div>

            <div style={{ fontSize: "11px", color: tema.textFaded }}>
              Escaneá para pedir
            </div>

            <div style={{ display: "flex", gap: "8px", width: "100%" }}>
              <button
                style={{
                  flex: 1,
                  ...s.btnSecundario,
                  fontSize: "12px",
                  padding: "8px 4px",
                }}
                onClick={() => descargarSVG(n)}
              >
                ↓ SVG
              </button>
              <button
                style={{
                  flex: 1,
                  ...s.btnPrimario,
                  fontSize: "12px",
                  padding: "8px 4px",
                }}
                onClick={() => imprimirUna(n)}
              >
                🖨 Imprimir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Instrucciones */}
      <div style={s.card}>
        <h3 style={s.cardTitulo}>Cómo usar</h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "13px",
            color: tema.textFaded,
          }}
        >
          <div>
            1. Ajustá la cantidad de mesas con los botones +/− de arriba.
          </div>
          <div>
            2. Imprimí cada QR individualmente o todos juntos en una grilla de 3
            columnas.
          </div>
          <div>3. Plastificá y colocá el QR en la mesa correspondiente.</div>
          <div>
            4. El cliente escanea con la cámara del celular — no necesita app.
          </div>
          <div>5. El menú se abre directamente con la mesa pre-cargada.</div>
        </div>
      </div>
    </div>
  );
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────

function Configuracion({ tema }) {
  const s = getStyles(tema);
  const [form, setForm] = useState({
    rs_nombre: localStorage.getItem("rs_nombre") || "HaceCafe",
    rs_subtitulo:
      localStorage.getItem("rs_subtitulo") || "Cafetería & Cocina Artesanal",
    rs_direccion: localStorage.getItem("rs_direccion") || "",
    rs_telefono: localStorage.getItem("rs_telefono") || "",
    rs_cuit: localStorage.getItem("rs_cuit") || "",
    rs_mesas: localStorage.getItem("rs_mesas") || "7",
    rs_dominio: localStorage.getItem("rs_dominio") || window.location.origin,
    mp_alias: localStorage.getItem("mp_alias") || "",
    mp_cbu: localStorage.getItem("mp_cbu") || "",
    mp_titular: localStorage.getItem("mp_titular") || "",
    mp_qr_url: localStorage.getItem("mp_qr_url") || "",
    transfer_alias: localStorage.getItem("transfer_alias") || "",
    transfer_cbu: localStorage.getItem("transfer_cbu") || "",
    transfer_titular: localStorage.getItem("transfer_titular") || "",
    transfer_banco: localStorage.getItem("transfer_banco") || "",
  });
  const [guardado, setGuardado] = useState(false);

  const guardar = () => {
    Object.entries(form).forEach(([k, v]) => localStorage.setItem(k, v));
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  const Campo = ({ campo, label, placeholder, fullWidth }) => (
    <div
      style={{ ...s.formGrupo, ...(fullWidth ? { gridColumn: "1/-1" } : {}) }}
    >
      <label style={s.formLabel}>{label}</label>
      <input
        style={s.formInput}
        value={form[campo] || ""}
        placeholder={placeholder || ""}
        onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
      />
    </div>
  );

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <h2 style={s.seccionTitulo}>Configuración del negocio</h2>
      </div>

      <div style={s.card}>
        <h3 style={s.cardTitulo}>Datos del local y tickets</h3>
        <div className="admin-form-grid" style={s.formGrid}>
          <Campo campo="rs_nombre" label="Nombre del local" />
          <Campo campo="rs_subtitulo" label="Subtítulo" />
          <Campo campo="rs_direccion" label="Dirección" />
          <Campo campo="rs_telefono" label="Teléfono" />
          <Campo campo="rs_cuit" label="CUIT / RUT" />
          <Campo campo="rs_mesas" label="Cantidad de mesas" />
          <Campo
            campo="rs_dominio"
            label="Dominio del sistema (para QR)"
            placeholder={window.location.origin}
            fullWidth
          />
        </div>
        <div style={{ fontSize: "11px", color: tema.textFaded }}>
          El dominio se usa para generar los QR de mesa. En desarrollo es{" "}
          <code style={{ color: tema.gold }}>{window.location.origin}</code>.
          Cambialo al hacer el deploy (ej: https://mi-cafeteria.com).
        </div>
      </div>

      <div style={s.card}>
        <h3 style={s.cardTitulo}>Mercado Pago</h3>
        <p style={{ fontSize: "12px", color: tema.textFaded, margin: 0 }}>
          El QR se genera automáticamente desde la URL de tu QR de MP. Lo
          encontrás en la app → Cobrar → compartir QR.
        </p>
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

      <button style={{ ...s.btnPrimario, marginTop: "4px" }} onClick={guardar}>
        {guardado ? "✓ Guardado" : "Guardar configuración"}
      </button>
    </div>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────

function getStyles(t) {
  return {
    root: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: t.bg,
    },
    header: {
      background: t.bgHeader,
      padding: "0 1rem",
      height: "56px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      borderBottom: `1px solid ${t.borderFaded}`,
    },
    headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
    menuBtn: {
      background: "transparent",
      border: "none",
      color: t.gold,
      fontSize: "20px",
      cursor: "pointer",
      padding: "4px 8px",
    },
    headerTitulo: {
      color: t.gold,
      fontWeight: "800",
      fontSize: "1rem",
      fontFamily: "Georgia, serif",
    },
    headerRight: { display: "flex", alignItems: "center", gap: "10px" },
    headerUsuario: { color: t.textSidebar, fontSize: "13px" },
    btnLogout: {
      background: "transparent",
      border: "1px solid rgba(255,255,255,0.3)",
      color: "rgba(255,255,255,0.8)",
      borderRadius: "8px",
      padding: "5px 12px",
      cursor: "pointer",
      fontSize: "12px",
    },

    layout: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },
    sidebar: {
      width: "175px",
      background: t.bgHeader,
      borderRight: `1px solid ${t.borderFaded}`,
      display: "flex",
      flexDirection: "column",
      padding: "1rem 0",
      flexShrink: 0,
      overflowY: "auto",
    },
    sidebarBtn: {
      padding: "11px 1.2rem",
      border: "none",
      background: "transparent",
      textAlign: "left",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      color: t.textSidebar,
      borderLeft: "3px solid transparent",
      transition: "all 0.15s",
    },
    sidebarBtnActivo: {
      color: t.gold,
      background: `${t.gold}18`,
      borderLeft: `3px solid ${t.gold}`,
    },

    // Contenido full-width sin maxWidth
    contenido: { flex: 1, overflowY: "auto", padding: "1.5rem", minWidth: 0 },
    seccion: {
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      width: "100%",
    },
    seccionHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "8px",
    },
    seccionTitulo: {
      fontSize: "1.2rem",
      fontWeight: "800",
      margin: 0,
      color: t.gold,
      fontFamily: "Georgia, serif",
    },

    // KPIs adaptivos
    kpiGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: "12px",
    },
    kpiCard: {
      background: t.bgCard,
      borderRadius: "12px",
      padding: "1rem 1.2rem",
      border: `1px solid ${t.borderFaded}`,
    },
    kpiLabel: {
      fontSize: "11px",
      color: t.textFaded,
      marginBottom: "6px",
      fontWeight: "600",
      letterSpacing: "0.6px",
      textTransform: "uppercase",
    },
    kpiValor: {
      fontSize: "1.7rem",
      fontWeight: "900",
      color: t.gold,
      lineHeight: 1,
    },
    kpiSub: { fontSize: "12px", color: t.textFaded, marginTop: "6px" },

    // Alertas
    alertaBox: {
      background: t.alertaBg,
      border: `1px solid ${t.alertaBorder}`,
      borderRadius: "12px",
      padding: "1rem 1.2rem",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    alertaTitulo: { fontWeight: "700", color: t.alertaText, fontSize: "14px" },
    alertaChip: {
      background: `${t.alertaText}18`,
      border: `1px solid ${t.alertaBorder}`,
      borderRadius: "20px",
      padding: "4px 12px",
      fontSize: "13px",
      color: t.alertaText,
    },

    // Filas de gráficos (flex wrapping)
    graficosRow: {
      display: "flex",
      gap: "14px",
      flexWrap: "wrap",
      alignItems: "flex-start",
    },

    // Cards
    card: {
      background: t.bgCard,
      borderRadius: "14px",
      padding: "1.2rem",
      border: `1px solid ${t.borderFaded}`,
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    },
    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    cardTitulo: {
      fontSize: "14px",
      fontWeight: "700",
      margin: 0,
      color: t.gold,
    },
    cardSubtitulo: { fontSize: "12px", color: t.textFaded },

    // Gráfico barras
    barChart: {
      display: "flex",
      alignItems: "flex-end",
      gap: "5px",
      height: "140px",
      paddingTop: "20px",
    },
    barCol: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flex: 1,
      height: "100%",
      minWidth: 0,
    },
    barLabelTop: {
      fontSize: "9px",
      color: t.textFaded,
      marginBottom: "3px",
      whiteSpace: "nowrap",
      overflow: "hidden",
    },
    barWrapper: {
      flex: 1,
      width: "100%",
      display: "flex",
      alignItems: "flex-end",
    },
    bar: {
      width: "100%",
      borderRadius: "4px 4px 0 0",
      minHeight: "3px",
      transition: "height 0.5s ease",
    },
    barLabelBot: { fontSize: "10px", marginTop: "4px" },

    // Stats boxes
    statBox: {
      background: `${t.gold}10`,
      border: `1px solid ${t.borderFaded}`,
      borderRadius: "10px",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
    },
    statLabel: { fontSize: "11px", color: t.textFaded, fontWeight: "600" },
    statValor: {
      fontSize: "1rem",
      fontWeight: "800",
      color: t.gold,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    statSub: { fontSize: "11px", color: t.textFaded },

    rankRow: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontSize: "14px",
      padding: "4px 0",
    },
    rankIndicador: {
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      flexShrink: 0,
    },
    rankNombre: { flex: 1, fontWeight: "600", color: t.text },
    rankCantidad: { color: t.textFaded, fontSize: "13px" },
    rankTotal: { fontWeight: "700", color: t.gold },

    vacio: {
      textAlign: "center",
      color: t.textFaded,
      padding: "3rem",
      fontSize: "14px",
    },
    cargando: { textAlign: "center", color: t.textFaded, padding: "3rem" },

    btnRefresh: {
      background: `${t.gold}18`,
      border: `1px solid ${t.borderFaded}`,
      borderRadius: "8px",
      padding: "6px 14px",
      cursor: "pointer",
      fontSize: "13px",
      color: t.gold,
    },
    btnPrimario: {
      background: t.accent,
      color: t.accentText,
      border: "none",
      borderRadius: "10px",
      padding: "11px 20px",
      fontWeight: "800",
      fontSize: "14px",
      cursor: "pointer",
    },
    btnSecundario: {
      background: "transparent",
      color: t.text,
      border: `1.5px solid ${t.borderFaded}`,
      borderRadius: "10px",
      padding: "10px 18px",
      fontWeight: "600",
      fontSize: "14px",
      cursor: "pointer",
    },
    btnIcono: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      color: t.gold,
      padding: "4px 8px",
    },
    // Botón contador circular para +/-
    btnContador: {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      background: t.bgLight,
      border: `1px solid ${t.borderFaded}`,
      fontSize: "20px",
      fontWeight: "700",
      color: t.gold,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },

    listaAdmin: { display: "flex", flexDirection: "column", gap: "8px" },
    listaItem: {
      background: t.bgCard,
      borderRadius: "10px",
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      border: `1px solid ${t.borderFaded}`,
    },
    listaItemInfo: { flex: 1, minWidth: 0 },
    listaItemNombre: {
      fontWeight: "700",
      fontSize: "14px",
      color: t.text,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    listaItemSub: { fontSize: "12px", color: t.textFaded, marginTop: "2px" },
    listaItemAcciones: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexShrink: 0,
    },
    stockPill: {
      borderRadius: "20px",
      padding: "3px 10px",
      fontSize: "12px",
      fontWeight: "700",
    },

    formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
    formGrupo: { display: "flex", flexDirection: "column", gap: "4px" },
    formLabel: {
      fontSize: "12px",
      fontWeight: "600",
      color: t.textFaded,
      letterSpacing: "0.5px",
    },
    formInput: {
      padding: "10px 12px",
      borderRadius: "8px",
      border: `1px solid ${t.borderFaded}`,
      fontSize: "14px",
      fontFamily: "inherit",
      background: t.inputBg,
      color: t.text,
      width: "100%",
      boxSizing: "border-box",
    },
    checkLabel: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "14px",
      cursor: "pointer",
      color: t.text,
    },

    stockRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      padding: "8px 0",
      borderBottom: `1px solid ${t.separador}`,
    },
    stockInfo: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    },
    stockNombre: { fontSize: "14px", fontWeight: "600", color: t.text },
    stockActualOk: { fontSize: "12px", color: t.verde },
    stockActualBajo: {
      fontSize: "12px",
      color: t.alertaText,
      fontWeight: "700",
    },
    stockAccion: { display: "flex", gap: "8px", alignItems: "center" },
    stockInput: {
      width: "80px",
      padding: "8px 10px",
      borderRadius: "8px",
      border: `1px solid ${t.borderFaded}`,
      fontSize: "14px",
      textAlign: "center",
      background: t.inputBg,
      color: t.text,
    },

    cajaRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 0",
      borderBottom: `1px solid ${t.separador}`,
    },
    cajaInfo: { display: "flex", flexDirection: "column", gap: "2px" },
    cajaNombre: { fontSize: "14px", fontWeight: "600", color: t.text },
    cajaSub: { fontSize: "12px", color: t.textFaded },
    cajaTotal: { fontSize: "15px", fontWeight: "800", color: t.gold },
  };
}
