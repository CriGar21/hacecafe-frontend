import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext();
const normalizarRol = (rol) => (rol === "DUEÑO" ? "DUENO" : rol);
const normalizarUsuario = (usuario) => usuario ? { ...usuario, rol: normalizarRol(usuario.rol) } : usuario;

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const usuarioGuardado = localStorage.getItem("usuario");
    if (token && usuarioGuardado) {
      try {
        const usuarioNormalizado = normalizarUsuario(JSON.parse(usuarioGuardado));
        localStorage.setItem("usuario", JSON.stringify(usuarioNormalizado));
        setUsuario(usuarioNormalizado);
      } catch {
        localStorage.removeItem("usuario");
      }
    }
    setCargando(false);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const usuarioNormalizado = normalizarUsuario(data.usuario);
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(usuarioNormalizado));
    setUsuario(usuarioNormalizado);
    return usuarioNormalizado;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
  };

  return <AuthContext.Provider value={{ usuario, login, logout, cargando }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
