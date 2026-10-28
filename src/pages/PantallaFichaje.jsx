import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const estilos = {
  pagina: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#100b08", padding: 20, fontFamily: "Inter, system-ui, sans-serif", color: "#f5eee5" },
  card: { background: "#1c1510", border: "1px solid #493525", padding: 28, borderRadius: 20, width: "100%", maxWidth: 480, boxShadow: "0 20px 70px #0008" },
  titulo: { margin: "0 0 8px", color: "#d8aa70", fontSize: 26 },
  muted: { color: "#b5a493", lineHeight: 1.6, fontSize: 14 },
  estado: { padding: 18, borderRadius: 14, margin: "22px 0", background: "#2b2118", border: "1px solid #59432d" },
  boton: { width: "100%", padding: 15, border: 0, borderRadius: 12, background: "#d8aa70", color: "#21150c", fontWeight: 800, fontSize: 16, cursor: "pointer" },
  secundario: { width: "100%", padding: 12, border: "1px solid #59432d", borderRadius: 12, background: "transparent", color: "#f5eee5", fontWeight: 600, cursor: "pointer", marginTop: 10 },
  mensaje: { marginTop: 14, padding: 12, borderRadius: 10, fontSize: 14, lineHeight: 1.5 },
};

const fechaHora = (fecha) => fecha ? new Date(fecha).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" }) : "Todavía no hay fichajes";

export default function PantallaFichaje() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [recordatorio, setRecordatorio] = useState(false);

  const cargarEstado = useCallback(async () => {
    try {
      const { data } = await api.get("/fichajes/mio");
      setEstado(data);
    } catch (error) {
      setResultado({ ok: false, texto: error.response?.data?.error || "No se pudo consultar tu estado." });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  useEffect(() => {
    if (!estado?.dentro || !estado?.ultimo?.creadoEn) { setRecordatorio(false); return; }
    const revisar = () => setRecordatorio(Date.now() - new Date(estado.ultimo.creadoEn).getTime() >= 4 * 60 * 60 * 1000);
    revisar();
    const timer = window.setInterval(revisar, 60000);
    return () => window.clearInterval(timer);
  }, [estado]);

  const fichar = () => {
    setResultado(null);
    if (!navigator.geolocation) {
      setResultado({ ok: false, texto: "Este navegador no permite obtener la ubicación." });
      return;
    }
    setEnviando(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const { data } = await api.post("/fichajes/mio", { latitud: coords.latitude, longitud: coords.longitude });
        setResultado({ ok: true, texto: data.aviso ? data.mensaje + " " + data.aviso : data.mensaje });
        await cargarEstado();
      } catch (error) {
        setResultado({ ok: false, texto: error.response?.data?.error || "No se pudo registrar el fichaje." });
      } finally {
        setEnviando(false);
      }
    }, () => {
      setResultado({ ok: false, texto: "No pudimos obtener la ubicación. Permití el acceso a la ubicación en el navegador y volvé a intentar." });
      setEnviando(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const dentro = Boolean(estado?.dentro);
  const seccionTrabajo = usuario?.rol === "COCINA" ? "/cocina" : "/empleado";

  return (
    <main style={estilos.pagina}>
      <section style={estilos.card}>
        <div style={{ fontSize: 12, letterSpacing: 3, color: "#b5a493", marginBottom: 12 }}>HACECafé · PRESENTISMO</div>
        <h1 style={estilos.titulo}>Hola, {usuario?.nombre || "equipo"}.</h1>
        <p style={estilos.muted}>Desde acá registrás tu ingreso y tu salida. El sistema usa tu sesión y la ubicación del dispositivo; no hace falta volver a escribir tu contraseña.</p>

        <div style={estilos.estado}>
          <div style={{ fontSize: 12, color: "#b5a493", marginBottom: 7 }}>ESTADO ACTUAL</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: dentro ? "#9be3a6" : "#d8aa70" }}>{cargando ? "Consultando..." : dentro ? "Turno en curso" : "Fuera de turno"}</div>
          <div style={{ ...estilos.muted, marginTop: 8 }}>Último registro: {fechaHora(estado?.ultimo?.creadoEn)}{estado?.ultimo ? ` · ${estado.ultimo.tipo === "INGRESO" ? "Ingreso" : "Salida"}` : ""}</div>
        </div>

        {recordatorio && <div role="alert" style={{ ...estilos.mensaje, background: "#50351b", color: "#ffe0a3" }}>Ya pasaron 4 horas desde tu ingreso. Recordá registrar la salida o confirmar con tu encargado si seguís trabajando. La salida no se marca sola: necesitás confirmarla.</div>}

        <button style={{ ...estilos.boton, opacity: cargando || enviando ? 0.6 : 1 }} onClick={fichar} disabled={cargando || enviando}>
          {enviando ? "Obteniendo ubicación..." : dentro ? "Registrar salida" : "Registrar ingreso"}
        </button>
        {resultado && <div role="status" style={{ ...estilos.mensaje, background: resultado.ok ? "#1e3a28" : "#4a2320", color: resultado.ok ? "#a8edb1" : "#ffc0b8" }}>{resultado.texto}</div>}

        <button style={estilos.secundario} onClick={() => navigate(seccionTrabajo)}>Ir a mi espacio de trabajo</button>
        {usuario?.rol === "DUENO" && <button style={estilos.secundario} onClick={() => navigate("/admin")}>Ir a administración</button>}
        <button style={{ ...estilos.secundario, border: 0 }} onClick={logout}>Cerrar sesión</button>
      </section>
    </main>
  );
}
