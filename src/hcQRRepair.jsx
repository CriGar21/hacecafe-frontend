import React from "react";
import { createRoot } from "react-dom/client";
import { QRCodeSVG } from "qrcode.react";

function dominioPublico() {
  const saved = localStorage.getItem("rs_dominio") || "";
  const clean = saved.trim().replace(/\/+$/, "");
  if (!clean || /localhost|127\.0\.0\.1/i.test(clean)) {
    const current = window.location.origin.replace(/\/+$/, "");
    localStorage.setItem("rs_dominio", current);
    return current;
  }
  return clean;
}

function reparar() {
  document.querySelectorAll('svg[id^="qr-mesa-"]').forEach((oldSvg) => {
    const host = oldSvg.parentElement;
    if (!host || host.dataset.hcQrRepaired === "true") return;
    const match = oldSvg.id.match(/^qr-mesa-(\d+)$/);
    if (!match) return;
    const mesa = match[1];
    host.dataset.hcQrRepaired = "true";
    createRoot(host).render(
      <QRCodeSVG
        id={`qr-mesa-${mesa}`}
        value={`${dominioPublico()}/menu?mesa=${mesa}`}
        size={140}
        bgColor="#ffffff"
        fgColor="#1a1a1a"
        level="H"
        includeMargin
      />,
    );
  });
}

new MutationObserver(reparar).observe(document.body, { childList: true, subtree: true });
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", reparar, { once: true });
else reparar();
