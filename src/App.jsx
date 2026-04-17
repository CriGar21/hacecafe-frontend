import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import MenuCliente from "./pages/MenuCliente";
import PantallaEmpleado from "./pages/PantallaEmpleado";
import PantallaCocina from "./pages/PantallaCocina";

const RutaProtegida = ({ children, roles }) => {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="loading">Cargando...</div>;
  if (!usuario) return <Navigate to="/login" />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/login" />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/menu" element={<MenuCliente />} />
          <Route
            path="/empleado"
            element={
              <RutaProtegida roles={["EMPLEADO", "DUEÑO"]}>
                <PantallaEmpleado />
              </RutaProtegida>
            }
          />
          <Route
            path="/cocina"
            element={
              <RutaProtegida roles={["COCINA", "DUEÑO", "EMPLEADO"]}>
                <PantallaCocina />
              </RutaProtegida>
            }
          />
          <Route path="/" element={<Navigate to="/menu" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
