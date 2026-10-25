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

function addPrintIcon(button) {
  if (button.querySelector(".hc-inline-print-icon")) return;
  const label = button.textContent.replace("🖨", "").trim();
  button.textContent = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "width:15px;height:15px;flex:0 0 15px";
  svg.innerHTML = '<path d="M7 9V4h10v5M6 17H4V10h16v7h-2M7 14h10v6H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M17 12h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>';
  svg.classList.add("hc-inline-print-icon");
  button.appendChild(svg);
  button.appendChild(document.createTextNode(label));
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.gap = "7px";
}

function enhanceOwnerUi() {
  const root = document.querySelector(".admin-shell");
  if (!root) return;
  const content = root.querySelector(".admin-contenido");
  if (!content) return;

  content.querySelectorAll("input[placeholder='Emoji']").forEach((input) => input.setAttribute("placeholder", "Código visual (ej. CAFÉ)"));
  content.querySelectorAll(".listaItemInfo").forEach((info) => {
    const icon = info.querySelector("span");
    const name = info.querySelector(".listaItemNombre");
    if (!icon || !name || icon.dataset.hcIconReady === "1") return;
    icon.dataset.hcIconReady = "1";
    icon.textContent = iconForLabel(name.textContent);
    icon.classList.add("hc-category-icon");
    icon.setAttribute("aria-hidden", "true");
  });

  const cfg = (() => { try { return JSON.parse(localStorage.getItem("menu_apariencia") || "{}"); } catch { return {}; } })();
  const logo = cfg.logoUrl || "";
  content.querySelectorAll("svg[id^='qr-mesa-']").forEach((svg) => {
    const qrBox = svg.parentElement;
    if (!qrBox || qrBox.dataset.hcQrReady === "1") return;
    qrBox.dataset.hcQrReady = "1";
    qrBox.classList.add("hc-qr-code");
    const badge = document.createElement("span");
    badge.setAttribute("aria-label", "Marca del local");
    badge.style.cssText = "position:absolute;right:7px;top:7px;width:34px;height:34px;padding:4px;display:grid;place-items:center;border:2px solid #fff;border-radius:9px;background:#17100b;color:#e4b16f;font:900 9px Georgia,serif;box-shadow:0 4px 10px rgba(0,0,0,.22);z-index:2;pointer-events:none";
    if (logo) {
      const img = document.createElement("img"); img.src = logo; img.alt = ""; img.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:5px"; badge.appendChild(img);
    } else badge.textContent = "HC";
    qrBox.appendChild(badge);
    const card = qrBox.parentElement?.parentElement;
    if (card) card.classList.add("hc-qr-card");
  });

  content.querySelectorAll("button").forEach((button) => {
    if (button.textContent.includes("🖨")) addPrintIcon(button);
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
        return <button key={key} title={TEMAS[key].nombre} onClick={() => cambiarTema(key)} style={{ width: "22px", height: "22px", borderRadius: "50%", border: activo ? `3px solid ${ring}` : "2px solid rgba(128,128,128,0.4)", background: bg, cursor: "pointer", padding: 0, transition: "all 0.2s", boxShadow: activo ? `0 0 0 2px ${ring}60` : "none", flexShrink: 0 }} />;
      })}
    </div>
  );
}
