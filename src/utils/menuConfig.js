// ─── Configuración de apariencia del menú cliente ─────────────
// Se guarda en localStorage y se lee desde MenuCliente.jsx

export const FUENTES_DISPONIBLES = [
  { id: "georgia",    label: "Georgia",     css: "'Georgia', 'Times New Roman', serif" },
  { id: "playfair",   label: "Playfair",    css: "'Playfair Display', Georgia, serif" },
  { id: "merriweather", label: "Merriweather", css: "'Merriweather', Georgia, serif" },
  { id: "raleway",    label: "Raleway",     css: "'Raleway', sans-serif" },
  { id: "josefin",    label: "Josefin Sans",css: "'Josefin Sans', sans-serif" },
];

export const CONFIG_DEFAULT = {
  // Identidad
  nombre:        "HaceCafe",
  subtitulo:     "Gastronomía Artesanal",
  bienvenida:    "",
  logoUrl:       "",
  heroBgUrl:     "",

  // Colores
  colorPrimario: "#C8913A",   // dorado — botones, precios, acentos
  colorFondo:    "#0f0d0b",   // fondo general
  colorCard:     "#1a1712",   // fondo de tarjetas
  colorTexto:    "#F0E6D3",   // texto principal

  // Tipografía
  fuenteId:      "georgia",
};

export function leerConfig() {
  const raw = localStorage.getItem("menu_apariencia");
  if (!raw) return CONFIG_DEFAULT;
  try {
    return { ...CONFIG_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return CONFIG_DEFAULT;
  }
}

export function guardarConfig(cfg) {
  localStorage.setItem("menu_apariencia", JSON.stringify(cfg));
}

export function getFuente(id) {
  return FUENTES_DISPONIBLES.find((f) => f.id === id)?.css || FUENTES_DISPONIBLES[0].css;
}

// Deriva colores secundarios a partir de los primarios
export function derivarColores(cfg) {
  const gold = cfg.colorPrimario;
  const bg   = cfg.colorFondo;
  const card = cfg.colorCard;
  const text = cfg.colorTexto;

  // Versiones con opacidad del color primario
  const goldFaded    = hexToRgba(gold, 0.12);
  const borderColor  = hexToRgba(gold, 0.12);
  const borderHover  = hexToRgba(gold, 0.35);
  const overlay      = hexToRgba(bg, 0.92);
  const bgModal      = adjustBrightness(bg, 0.9);

  return { gold, bg, card, text, goldFaded, borderColor, borderHover, overlay, bgModal };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function adjustBrightness(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}