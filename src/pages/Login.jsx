import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const usuario = await login(email, password);
      if (usuario.rol === "COCINA") navigate("/cocina");
      else if (usuario.rol === "EMPLEADO" || usuario.rol === "DUEÑO")
        navigate("/empleado");
    } catch {
      setError("Email o contraseña incorrectos");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.titulo}>HaceCafe</h1>
        <p style={styles.subtitulo}>Sistema de gestión</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.btn} disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f5f5f5",
  },
  card: {
    background: "white",
    padding: "2.5rem",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "380px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  titulo: {
    fontSize: "2rem",
    fontWeight: "700",
    textAlign: "center",
    margin: "0 0 4px",
    color: "#1a1a1a",
  },
  subtitulo: {
    textAlign: "center",
    color: "#888",
    marginBottom: "2rem",
    fontSize: "14px",
  },
  form: { display: "flex", flexDirection: "column", gap: "12px" },
  input: {
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1.5px solid #e0e0e0",
    fontSize: "15px",
    outline: "none",
  },
  btn: {
    padding: "13px",
    borderRadius: "10px",
    background: "#1a1a1a",
    color: "white",
    fontWeight: "600",
    fontSize: "15px",
    border: "none",
    cursor: "pointer",
    marginTop: "8px",
  },
  error: { color: "#e53e3e", fontSize: "13px", textAlign: "center", margin: 0 },
};
