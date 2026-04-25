import { createContext, useContext, useState, useEffect } from "react";

export const TEMAS = {
  oscuro: {
    nombre: "Oscuro",
    bg: "#1a1612",
    bgCard: "#242018",
    bgLight: "#2e2820",
    bgSidebar: "#1a1208",
    bgHeader: "#1a1208",
    gold: "#C8913A",
    goldCl: "#E8B96A",
    text: "#F0E6D3",
    textSub: "#9A8870",
    textFaded: "rgba(245,215,142,0.5)",
    textSidebar: "rgba(245,215,142,0.5)",
    textSidebarActivo: "#F5D78E",
    border: "#3a3228",
    borderFaded: "rgba(200,145,58,0.2)",
    accent: "#C8913A",
    accentText: "#1a0e00",
    btnActivo: "rgba(200,145,58,0.1)",
    btnActivoBorder: "rgba(200,145,58,0.1)",
    alertaBg: "rgba(139,32,32,0.2)",
    alertaBorder: "rgba(139,32,32,0.5)",
    alertaText: "#e07070",
    verde: "#90e090",
    verdeBg: "#1a3d22",
    verdeBorder: "#5aaa5a",
    inputBg: "#1a1208",
    cardTitle: "#F5D78E",
    separador: "rgba(200,145,58,0.15)",
  },
  natural: {
    nombre: "Natural",
    bg: "#F2F2F2",
    bgCard: "#EBE7D0",
    bgLight: "#E9D5B2",
    bgSidebar: "#445925",
    bgHeader: "#445925",
    gold: "#BC6849",
    goldCl: "#D4875F",
    text: "#2D201F",
    textSub: "#5C4033",
    textFaded: "rgba(44,32,31,0.55)",
    textSidebar: "rgba(255,255,255,0.6)",
    textSidebarActivo: "#F2F2F2",
    border: "#C4B49A",
    borderFaded: "rgba(188,104,73,0.3)",
    accent: "#445925",
    accentText: "#F2F2F2",
    btnActivo: "rgba(68,89,37,0.12)",
    btnActivoBorder: "rgba(68,89,37,0.4)",
    alertaBg: "rgba(139,32,32,0.08)",
    alertaBorder: "rgba(139,32,32,0.25)",
    alertaText: "#7a1f1f",
    verde: "#2D5016",
    verdeBg: "#DEE8D2",
    verdeBorder: "#9BAB8F",
    inputBg: "#EBE7D0",
    cardTitle: "#2D201F",
    separador: "rgba(188,104,73,0.15)",
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [temaActual, setTemaActual] = useState(
    () => localStorage.getItem("hacecafe_tema") || "oscuro",
  );

  const tema = TEMAS[temaActual];

  const cambiarTema = (nombre) => {
    setTemaActual(nombre);
    localStorage.setItem("hacecafe_tema", nombre);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-tema", temaActual);
    document.body.style.background = tema.bg;
    document.body.style.color = tema.text;
  }, [tema, temaActual]);

  return (
    <ThemeContext.Provider value={{ tema, temaActual, cambiarTema, TEMAS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTema = () => useContext(ThemeContext);
