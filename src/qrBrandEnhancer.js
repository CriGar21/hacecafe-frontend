function dominioPublico() {
  const fallback = window.location.origin;
  const raw = String(localStorage.getItem("rs_dominio") || fallback).trim().replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const local = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || /^192\.168\./.test(host) || /^10\./.test(host);
    const fallbackHost = new URL(fallback).hostname.toLowerCase();
    if (local && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(fallbackHost)) return fallback;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

function aplicarMarcaQR() {
  if (typeof document === "undefined") return;
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem("menu_apariencia") || "{}"); } catch { cfg = {}; }
  const logoUrl = String(cfg.logoUrl || "").trim();
  const base = dominioPublico();
  const esLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(base);

  document.querySelectorAll('svg[id^="qr-mesa-"]').forEach((svg) => {
    const card = svg.parentElement;
    if (!card) return;
    const match = svg.id.match(/^qr-mesa-(\d+)$/);
    const mesa = match?.[1];
    if (!mesa) return;

    if (logoUrl) {
      let badge = card.querySelector(".hc-qr-real-logo");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "hc-qr-real-logo";
        badge.setAttribute("aria-hidden", "true");
        card.appendChild(badge);
      }
      badge.style.backgroundImage = `url(${JSON.stringify(logoUrl)})`;
      badge.title = "Logo del local";
    }

    const url = `${base}/menu?mesa=${encodeURIComponent(mesa)}`;
    let test = card.parentElement?.querySelector(`.hc-qr-test[data-mesa="${mesa}"]`);
    if (!test) {
      test = document.createElement("a");
      test.className = "hc-qr-test";
      test.dataset.mesa = mesa;
      test.target = "_blank";
      test.rel = "noopener noreferrer";
      test.textContent = "Probar QR";
      card.parentElement?.appendChild(test);
    }
    test.href = url;
    test.title = esLocal ? "En producción el QR usará el dominio público configurado" : `Abrir Mesa ${mesa}`;
    test.dataset.local = esLocal ? "true" : "false";
  });
}

export function instalarMarcaQR() {
  if (typeof window === "undefined") return;
  const ejecutar = () => window.requestAnimationFrame(aplicarMarcaQR);
  const observer = new MutationObserver(ejecutar);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("menu-apariencia-guardada", ejecutar);
  window.addEventListener("storage", ejecutar);
  window.addEventListener("config-negocio-sincronizada", ejecutar);
  ejecutar();
  return () => {
    observer.disconnect();
    window.removeEventListener("menu-apariencia-guardada", ejecutar);
    window.removeEventListener("storage", ejecutar);
    window.removeEventListener("config-negocio-sincronizada", ejecutar);
  };
}
