import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      await login(email, password);
    } catch {
      setError("Email o contraseña incorrectos");
    } finally {
      setCargando(false);
    }
  };

  const ACCESOS = [
    { label: "👨‍💼 Panel Admin", info: "Rol: Dueño", path: "/admin" },
    { label: "🧑‍🍳 Cocina", info: "Rol: Cocina", path: "/cocina" },
    { label: "☕ Empleado", info: "Rol: Empleado", path: "/empleado" },
    { label: "📱 Menú cliente", info: "Sin login", path: "/menu" },
  ];

  return (
    <div style={st.bg}>
      <div style={st.card}>
        {/* Logo */}
        <div style={st.logoWrap}>
          <span style={{ fontSize: "1.8rem" }}>☕</span>
        </div>
        <h1 style={st.titulo}>HaceCafe</h1>
        <p style={st.subtitulo}>Sistema de gestión</p>

        {/* Formulario */}
        <form onSubmit={handleLogin} style={st.form}>
          <div style={st.grupo}>
            <label style={st.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@hacecafe.com"
              style={st.input}
              required
              autoComplete="email"
            />
          </div>

          <div style={st.grupo}>
            <label style={st.label}>Contraseña</label>
            <div style={st.inputWrap}>
              <input
                type={verPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...st.input, paddingRight: "44px" }}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                style={st.ojoBtn}
                onClick={() => setVerPassword((v) => !v)}
                tabIndex={-1}
              >
                {verPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && <div style={st.error}>{error}</div>}

          <button
            type="submit"
            style={{ ...st.btnLogin, opacity: cargando ? 0.7 : 1 }}
            disabled={cargando}
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {/* Accesos directos */}
        <div style={st.selectorWrap}>
          <p style={st.selectorTitulo}>Accesos directos</p>
          <div style={st.selectorGrid}>
            {ACCESOS.map(({ label, info, path }) => (
              <button
                key={path}
                style={st.selectorBtn}
                onClick={() => navigate(path)}
                type="button"
              >
                <div style={{ fontWeight: "700", fontSize: "13px" }}>
                  {label}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#9A8870",
                    marginTop: "2px",
                  }}
                >
                  {info}
                </div>
              </button>
            ))}
          </div>
          <p
            style={{
              fontSize: "11px",
              color: "#9A8870",
              textAlign: "center",
              marginTop: "10px",
              margin: "10px 0 0",
            }}
          >
            El sistema te redirige automáticamente según tu rol al ingresar
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── COLORES ──────────────────────────────────────────────────
const C = {
  bg: "#1a1612",
  card: "#242018",
  light: "#2e2820",
  gold: "#C8913A",
  text: "#F0E6D3",
  sub: "#9A8870",
  border: "#3a3228",
  error: "#e07070",
};

// ─── ESTILOS ──────────────────────────────────────────────────
const st = {
  bg: {
    minHeight: "100vh",
    background: C.bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
  },
  card: {
    background: C.card,
    borderRadius: "20px",
    padding: "2.5rem 2rem",
    width: "100%",
    maxWidth: "400px",
    border: `1px solid ${C.border}`,
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
    display: "flex",
    flexDirection: "column",
  },
  logoWrap: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "rgba(200,145,58,0.15)",
    border: `2px solid ${C.gold}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 1rem",
  },
  titulo: {
    color: C.gold,
    fontFamily: "Georgia, serif",
    fontWeight: "800",
    fontSize: "1.8rem",
    textAlign: "center",
    margin: "0 0 4px",
  },
  subtitulo: {
    color: C.sub,
    fontSize: "13px",
    textAlign: "center",
    margin: "0 0 2rem",
    letterSpacing: "1px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  grupo: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: C.sub,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    padding: "12px 14px",
    borderRadius: "10px",
    border: `1px solid ${C.border}`,
    fontSize: "15px",
    fontFamily: "inherit",
    background: C.light,
    color: C.text,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  ojoBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    padding: "4px",
    lineHeight: 1,
  },
  error: {
    color: C.error,
    fontSize: "13px",
    textAlign: "center",
    padding: "8px 12px",
    background: "rgba(224,112,112,0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(224,112,112,0.2)",
  },
  btnLogin: {
    background: C.gold,
    color: "#1a0e00",
    border: "none",
    borderRadius: "12px",
    padding: "14px",
    fontWeight: "800",
    fontSize: "16px",
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    letterSpacing: "0.5px",
    marginTop: "4px",
    width: "100%",
  },
  selectorWrap: {
    marginTop: "2rem",
    paddingTop: "1.5rem",
    borderTop: `1px solid ${C.border}`,
  },
  selectorTitulo: {
    color: C.sub,
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    textAlign: "center",
    margin: "0 0 12px",
  },
  selectorGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  selectorBtn: {
    padding: "10px 8px",
    borderRadius: "10px",
    border: `1px solid ${C.border}`,
    background: C.light,
    color: C.text,
    fontSize: "13px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};
