import { useState } from "react";
import api from "../services/api";

const estilos = {
  pagina: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0d0b", padding: 16, fontFamily: "Georgia, serif" },
  card: { background: "#1a1712", color: "#F0E6D3", padding: 28, borderRadius: 16, width: "100%", maxWidth: 380, boxShadow: "0 10px 30px rgba(0,0,0,.4)" },
  titulo: { textAlign: "center", margin: "0 0 20px", fontSize: 22, color: "#C8913A" },
  label: { display: "block", fontSize: 13, marginBottom: 6, opacity: 0.8 },
  campo: { width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #3a3226", background: "#0f0d0b", color: "#F0E6D3", fontSize: 16, marginBottom: 16 },
  tipos: { display: "flex", gap: 8, marginBottom: 16 },
  boton: { width: "100%", padding: 14, border: "none", borderRadius: 10, background: "#C8913A", color: "#0f0d0b", fontWeight: 700, fontSize: 16, cursor: "pointer" },
  mensaje: { marginTop: 16, padding: 12, borderRadius: 10, textAlign: "center", fontSize: 14 },
};

export default function PantallaFichaje() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tipo, setTipo] = useState("INGRESO");
  const [resultado, setResultado] = useState(null); // { ok, texto }
  const [cargando, setCargando] = useState(false);

  const fichar = (e) => {
    e.preventDefault();
    setResultado(null);

    if (!navigator.geolocation) {
      setResultado({ ok: false, texto: "Tu navegador no soporta geolocalización." });
      return;
    }

    setCargando(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { data } = await api.post("/fichajes", {
            email: email.trim(),
            password,
            tipo,
            latitud: coords.latitude,
            longitud: coords.longitude,
          });
          setResultado({ ok: true, texto: data.mensaje });
          setPassword("");
        } catch (err) {
          setResultado({ ok: false, texto: err.response?.data?.error || "Error de conexión al servidor." });
        } finally {
          setCargando(false);
        }
      },
      () => {
        setResultado({ ok: false, texto: "No se pudo obtener la ubicación. Activá el permiso de GPS (y usá https)." });
        setCargando(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const botonTipo = (valor) => ({
    flex: 1, padding: 10, borderRadius: 10, cursor: "pointer", fontWeight: 600,
    border: `1px solid ${tipo === valor ? "#C8913A" : "#3a3226"}`,
    background: tipo === valor ? "#C8913A" : "transparent",
    color: tipo === valor ? "#0f0d0b" : "#F0E6D3",
  });

  return (
    <div style={estilos.pagina}>
      <form style={estilos.card} onSubmit={fichar}>
        <h2 style={estilos.titulo}>Control de presentismo</h2>

        <div style={estilos.tipos}>
          <button type="button" style={botonTipo("INGRESO")} onClick={() => setTipo("INGRESO")}>Ingreso</button>
          <button type="button" style={botonTipo("EGRESO")} onClick={() => setTipo("EGRESO")}>Salida</button>
        </div>

        <label style={estilos.label} htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={estilos.campo}
          placeholder="tu@email.com"
          required
        />

        <label style={estilos.label} htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={estilos.campo}
          required
        />

        <button type="submit" style={{ ...estilos.boton, opacity: cargando || !email || !password ? 0.5 : 1 }} disabled={cargando || !email || !password}>
          {cargando ? "Validando ubicación..." : "Registrar fichaje"}
        </button>

        {resultado && (
          <div style={{ ...estilos.mensaje, background: resultado.ok ? "#1f3a24" : "#3a1f1f", color: resultado.ok ? "#9be3a6" : "#f0a0a0" }}>
            {resultado.texto}
          </div>
        )}
      </form>
    </div>
  );
}
