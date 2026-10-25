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
  { id: "dashboard", label: "Dashboard" }, { id: "productos", label: "Productos" }, { id: "stock", label: "Stock" },
  { id: "usuarios", label: "Usuarios" }, { id: "caja", label: "Caja" }, { id: "categorias", label: "Categorías" },
  { id: "qrmesas", label: "QR Mesas" }, { id: "apariencia", label: "Apariencia" }, { id: "config", label: "Config." },
];

export default function PanelDueno() {
  const { usuario, logout } = useAuth(); const { tema } = useTema(); const s = getStyles(tema);
  const [seccion, setSeccion] = useState("dashboard"); const [menuAbierto, setMenuAbierto] = useState(false); const navigate = useNavigate();
  return <div style={s.root}>
    <div style={s.header}><div style={s.headerLeft}><button className="admin-menu-btn" style={s.menuBtn} onClick={() => setMenuAbierto(!menuAbierto)}>☰</button><span style={s.headerTitulo}>HaceCafe Admin</span></div>
      <div style={s.headerRight}><SelectorTema /><span style={s.headerUsuario}>{usuario?.nombre}</span><button style={s.btnLogout} onClick={() => navigate("/empleado")}>Tomar pedido</button><button style={s.btnLogout} onClick={logout}>Salir</button></div></div>
    <div style={s.layout}><div className={`admin-sidebar${menuAbierto ? " open" : ""}`} style={s.sidebar}>{SECCIONES.map(sec => <button key={sec.id} style={{ ...s.sidebarBtn, ...(seccion === sec.id ? s.sidebarBtnActivo : {}) }} onClick={() => { setSeccion(sec.id); setMenuAbierto(false); }}>{sec.label}</button>)}</div>
      {menuAbierto && <div className="admin-overlay" onClick={() => setMenuAbierto(false)} />}<div className="admin-contenido" style={s.contenido}>
        {seccion === "dashboard" && <Dashboard tema={tema} />}{seccion === "productos" && <Productos tema={tema} />}{seccion === "stock" && <Stock tema={tema} />}{seccion === "usuarios" && <Usuarios tema={tema} />}{seccion === "caja" && <Caja tema={tema} />}{seccion === "categorias" && <Categorias tema={tema} />}{seccion === "qrmesas" && <QRMesas tema={tema} />}{seccion === "apariencia" && <Apariencia tema={tema} />}{seccion === "config" && <Configuracion tema={tema} />}
      </div></div>
  </div>;
}

// ─── CONFIGURACIÓN ────────────────────────────────────────────
function Configuracion({ tema }) {
  const s = getStyles(tema);
  const [form, setForm] = useState({
    rs_nombre: "HaceCafe", rs_subtitulo: "Cafetería & Cocina Artesanal", rs_direccion: "", rs_telefono: "", rs_cuit: "", rs_mesas: "7", rs_dominio: "",
    mp_alias: "", mp_cbu: "", mp_titular: "", mp_qr_url: "", transfer_alias: "", transfer_cbu: "", transfer_titular: "", transfer_banco: "",
  });
  const [cargando, setCargando] = useState(true); const [guardando, setGuardando] = useState(false); const [mensaje, setMensaje] = useState(""); const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    api.get("/config/negocio").then(r => { if (vivo) setForm(prev => ({ ...prev, ...r.data })); }).catch(e => { if (vivo) setError(e.response?.data?.error || "No se pudo cargar la configuración"); }).finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
  }, []);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const guardar = async () => {
    setGuardando(true); setMensaje(""); setError("");
    try {
      const { data } = await api.put("/config/negocio", form);
      setForm(prev => ({ ...prev, ...data }));
      setMensaje("✓ Configuración guardada en la base de datos");
      window.dispatchEvent(new Event("config-negocio-guardada"));
    } catch (e) { setError(e.response?.data?.error || "No se pudo guardar la configuración"); }
    finally { setGuardando(false); }
  };
  const Campo = ({ campo, label, placeholder, fullWidth }) => <div style={{ ...s.formGrupo, ...(fullWidth ? { gridColumn: "1/-1" } : {}) }}><label style={s.formLabel}>{label}</label><input style={s.formInput} value={form[campo] ?? ""} placeholder={placeholder || ""} onChange={e => set(campo, e.target.value)} /></div>;

  if (cargando) return <div style={s.cargando}>Cargando configuración...</div>;
  return <div style={s.seccion}>
    <div style={s.seccionHeader}><h2 style={s.seccionTitulo}>Configuración del negocio</h2></div>
    {error && <div style={{ ...s.alertaBox, color: tema.alertaText }}>{error}</div>}
    {mensaje && <div style={{ ...s.alertaBox, color: tema.verde }}>{mensaje}</div>}
    <div style={s.card}><h3 style={s.cardTitulo}>Datos del local y tickets</h3><div className="admin-form-grid" style={s.formGrid}>
      <Campo campo="rs_nombre" label="Nombre del local" /><Campo campo="rs_subtitulo" label="Subtítulo" /><Campo campo="rs_direccion" label="Dirección" /><Campo campo="rs_telefono" label="Teléfono" /><Campo campo="rs_cuit" label="CUIT / RUT" /><Campo campo="rs_mesas" label="Cantidad de mesas" /><Campo campo="rs_dominio" label="Dominio del sistema (para QR)" placeholder={window.location.origin} fullWidth />
    </div><div style={{ fontSize: "11px", color: tema.textFaded }}>El dominio se usa para generar los QR de mesa. En desarrollo es <code style={{ color: tema.gold }}>{window.location.origin}</code>.</div></div>
    <div style={s.card}><h3 style={s.cardTitulo}>Mercado Pago</h3><p style={{ fontSize: "12px", color: tema.textFaded, margin: 0 }}>Estos datos quedan guardados en el servidor y estarán disponibles desde cualquier dispositivo.</p><div className="admin-form-grid" style={s.formGrid}><Campo campo="mp_alias" label="Alias de MP" /><Campo campo="mp_titular" label="Titular de la cuenta" /><Campo campo="mp_cbu" label="CVU (opcional)" /><Campo campo="mp_qr_url" label="URL del QR de MP (opcional)" /></div></div>
    <div style={s.card}><h3 style={s.cardTitulo}>Transferencia bancaria</h3><div className="admin-form-grid" style={s.formGrid}><Campo campo="transfer_alias" label="Alias" /><Campo campo="transfer_titular" label="Titular" /><Campo campo="transfer_cbu" label="CBU" /><Campo campo="transfer_banco" label="Banco" /></div></div>
    <button disabled={guardando} style={{ ...s.btnPrimario, marginTop: "4px", opacity: guardando ? 0.7 : 1 }} onClick={guardar}>{guardando ? "Guardando..." : "Guardar configuración"}</button>
  </div>;
}

// Los componentes restantes del panel se mantienen en el archivo original.
