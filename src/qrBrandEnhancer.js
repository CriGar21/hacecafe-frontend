function aplicarMarcaQR() {
  if (typeof document === "undefined") return;
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem("menu_apariencia") || "{}"); } catch { cfg = {}; }
  const logoUrl = String(cfg.logoUrl || "").trim();
  document.querySelectorAll('svg[id^="qr-mesa-"]').forEach((svg) => {
    const card = svg.parentElement;
    if (!card) return;
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
  });
}

export function instalarMarcaQR() {
  if (typeof window === "undefined") return;
  const ejecutar = () => window.requestAnimationFrame(aplicarMarcaQR);
  const observer = new MutationObserver(ejecutar);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("menu-apariencia-guardada", ejecutar);
  window.addEventListener("storage", ejecutar);
  ejecutar();
  return () => {
    observer.disconnect();
    window.removeEventListener("menu-apariencia-guardada", ejecutar);
    window.removeEventListener("storage", ejecutar);
  };
}
