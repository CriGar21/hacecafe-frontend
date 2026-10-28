import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import MenuCliente from "./pages/MenuCliente";
import PantallaEmpleadoProfesional from "./pages/PantallaEmpleadoProfesional";
import PantallaCocina from "./pages/PantallaCocina";
import PanelDueno from "./pages/PanelDueno";
import PanelComercial from "./pages/PanelComercial";
import PantallaFichaje from "./pages/PantallaFichaje";

const RutaProtegida = ({ children, roles }) => {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div style={{ padding: "2rem", textAlign: "center" }}>Cargando...</div>;
  if (!usuario) return <Navigate to="/login" />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/login" />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/menu" element={<MenuCliente />} />
        <Route path="/fichaje" element={<RutaProtegida roles={["EMPLEADO", "COCINA", "DUENO"]}><PantallaFichaje /></RutaProtegida>} />
        <Route path="/empleado" element={<RutaProtegida roles={["EMPLEADO", "DUENO"]}><PantallaEmpleadoProfesional /></RutaProtegida>} />
        <Route path="/cocina" element={<RutaProtegida roles={["COCINA", "DUENO", "EMPLEADO"]}><PantallaCocina /></RutaProtegida>} />
        <Route path="/admin/comercial" element={<RutaProtegida roles={["DUENO"]}><PanelComercial /></RutaProtegida>} />
        <Route path="/admin/*" element={<RutaProtegida roles={["DUENO"]}><PanelDueno /></RutaProtegida>} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
