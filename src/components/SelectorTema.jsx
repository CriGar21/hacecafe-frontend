import { useEffect } from "react";
import { useTema, TEMAS } from "../context/ThemeContext";

function iconForLabel(label) {
  const text = String(label || "").toLowerCase();
  if (text.includes("café") || text.includes("cafe")) return "CAFÉ";
  if (text.includes("pan") || text.includes("torta") || text.includes("desay")) return "PAN";
  if (text.includes("jugo") || text.includes("fresco") || text.includes("limon")) return "JUGO";
  if (text.includes("dulce") || text.includes("postre") || text.includes("helado") || text.includes("choc")) return "DULCE";
  if (text.includes("sándwich") || text.includes("sandwich") || text.includes("salado")) return "SALADO";
  if (text.includes("té") || text.includes("te") || text.includes("infus")) return "TÉ";
  if (text.includes("frío") || text.includes("frio") || text.includes("bebida")) return "FRÍO";
  if (text.includes("pizza")) return "PIZZA";
  return text.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase() || "CAT";
}

function enhanceOwnerUi() {
  const root = document.querySelector(".admin-shell");
  if (!root) return;
  const content = root.querySelector(".admin-contenido");
  if (!content) return;

  /* Categories: replace stored emoji drawings with stable text/SVG-style badges. */
  content.querySelectorAll("input[placeholder='Emoji']").forEach((input) => input.setAttribute("placeholder", "Código visual (ej. CAFÉ)"));
  content.querySelectorAll(".listaItemInfo").forEach((info) => {
    const icon = info.querySelector("span");
    const name = info.querySelector(".listaItemNombre");
    if (!icon || !name) return;
    if (icon.dataset.hcIconReady === "1") return;
    icon.dataset.hcIconReady = "1";
    icon.textContent = iconForLabel(name.textContent);
    icon.className = `${icon.className || ""} hc-category-icon`.trim();
    icon.setAttribute("aria-hidden", "true");
  });

  /* QR cards: add the brand mark beside the QR, never over the encoded modules. */
  const cfg = (() => { try { return JSON.parse(localStorage.getItem("menu_apariencia") || "{}"); } catch { return {}; } })();
  const logo = cfg.logoUrl || "";
  content.querySelectorAll("svg[id^='qr-mesa-']").forEach((svg) => {
    const qrBox = svg.parentElement;
    if (!qrBox || qrBox.dataset.hcQrReady === "1") return;
    qrBox.dataset.hcQrReady = "1";
    qrBox.classList.add("hc-qr-code");
    const badge = document.createElement("span");
    badge.className = "hc-qr-brand-badge";
    badge.setAttribute("aria-label", "Marca del local");
    if (logo) {
      const img = document.createElement("img");
      img.src = logo;
      img.alt = "";
      badge.appendChild(img);
    } else {
      badge.textContent = "HC";
    }
    qrBox.appendChild(badge);
    const card = qrBox.closest("div[style*='textAlign']") || qrBox.parentElement;
    if (card) card.classList.add("hc-qr-card");
  });

  /* Replace printer glyphs with a CSS icon so the OS never decides how it looks. */
  content.querySelectorAll("button").forEach((button) => {
    const value = button.textContent.trim();
    if (value.includes("🖨")) {
      button.textContent = value.replace("🖨", "").trim();
      button.classList.add("hc-print-action");
    }
  });
}

export default function SelectorTema({ style = {} }) {
  const { temaActual, cambiarTema } = useTema();

  useEffect(() => {
    const run = () => enhanceOwnerUi();
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const coloresBotones = {
    oscuro: { bg: "#1a1612", ring: "#C8913A" },
    natural: { bg: "#445925", ring: "#BC6849" },
  };

  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center", ...style }}>
      {Object.keys(TEMAS).map((key) => {
        const activo = temaActual === key;
        const { bg, ring } = coloresBotones[key];
        return (
          <button key={key} title={TEMAS[key].nombre} onClick={() => cambiarTema(key)} style={{ width: "22px", height: "22px", borderRadius: "50%", border: activo ? `3px solid ${ring}` : "2px solid rgba(128,128,128,0.4)", background: bg, cursor: "pointer", padding: 0, transition: "all 0.2s", boxShadow: activo ? `0 0 0 2px ${ring}60` : "none", flexShrink: 0 }} />
        );
      })}
    </div>
  );
}
