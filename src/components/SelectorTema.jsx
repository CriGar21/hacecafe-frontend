import { useTema, TEMAS } from "../context/ThemeContext";

export default function SelectorTema({ style = {} }) {
  const { temaActual, cambiarTema } = useTema();

  const coloresBotones = {
    oscuro: { bg: "#1a1612", ring: "#C8913A" },
    natural: { bg: "#445925", ring: "#BC6849" },
  };

  return (
    <div
      style={{ display: "flex", gap: "6px", alignItems: "center", ...style }}
    >
      {Object.keys(TEMAS).map((key) => {
        const activo = temaActual === key;
        const { bg, ring } = coloresBotones[key];
        return (
          <button
            key={key}
            title={TEMAS[key].nombre}
            onClick={() => cambiarTema(key)}
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border: activo
                ? `3px solid ${ring}`
                : "2px solid rgba(128,128,128,0.4)",
              background: bg,
              cursor: "pointer",
              padding: 0,
              transition: "all 0.2s",
              boxShadow: activo ? `0 0 0 2px ${ring}60` : "none",
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
