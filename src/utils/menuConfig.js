import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const CACHE_KEY = "menu_apariencia";
const NEGOCIO_KEYS = ["rs_nombre", "rs_subtitulo", "rs_direccion", "rs_telefono", "rs_cuit", "rs_mesas", "rs_dominio", "mp_alias", "mp_cbu", "mp_titular", "mp_qr_url", "transfer_alias", "transfer_cbu", "transfer_titular", "transfer_banco"];
const negocioState = { timer: null, sincronizando: false, instalado: false };

export const FUENTES_DISPONIBLES = [
  { id: "georgia", label: "Georgia", css: "'Georgia', 'Times New Roman', serif", google: null },
  { id: "playfair", label: "Playfair Display", css: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@500;700;800" },
  { id: "merriweather", label: "Merriweather", css: "'Merriweather', Georgia, serif", google: "Merriweather:wght@400;700;900" },
  { id: "raleway", label: "Raleway", css: "'Raleway', sans-serif", google: "Raleway:wght@500;700;800" },
  { id: "josefin", label: "Josefin Sans", css: "'Josefin Sans', sans-serif", google: "Josefin+Sans:wght@500;700" },
  { id: "poppins", label: "Poppins", css: "'Poppins', sans-serif", google: "Poppins:wght@500;600;700;800" },
  { id: "outfit", label: "Outfit", css: "'Outfit', sans-serif", google: "Outfit:wght@500;600;700;800" },
];

export const CONFIG_DEFAULT = {
  nombre: "HaceCafe", subtitulo: "Gastronomía artesanal", bienvenida: "", logoUrl: "", heroBgUrl: "",
  colorPrimario: "#C8913A", colorFondo: "#0f0d0b", colorCard: "#1a1712", colorTexto: "#F0E6D3", fuenteId: "georgia",
};

function normalizarDominio(valor) {
  const fallback = typeof window !== "undefined" ? window.location.origin : "";
  const limpio = String(valor || "").trim().replace(/\/+$/, "");
  if (!limpio) return fallback;
  try {
    const url = new URL(limpio);
    if (!/^https?:$/.test(url.protocol)) return fallback;
    const host = url.hostname.toLowerCase();
    const esLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || /^192\.168\./.test(host) || /^10\./.test(host);
    if (esLocal && fallback && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(new URL(fallback).hostname)) return fallback;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`.replace(/\/$/, "") || url.origin;
  } catch {
    return fallback;
  }
}

export function getDominioPublico(valor) {
  return normalizarDominio(valor || (typeof localStorage !== "undefined" ? localStorage.getItem("rs_dominio") : ""));
}

function leerNegocioLocal() {
  const out = {};
  NEGOCIO_KEYS.forEach((key) => { const value = localStorage.getItem(key); if (value !== null) out[key] = value; });
  if (out.rs_dominio) out.rs_dominio = normalizarDominio(out.rs_dominio);
  return out;
}

function programarGuardadoNegocio() {
  if (negocioState.sincronizando || !localStorage.getItem("token")) return;
  clearTimeout(negocioState.timer);
  negocioState.timer = setTimeout(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetch(`${API}/config/negocio`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(leerNegocioLocal()) });
      window.dispatchEvent(new Event("config-negocio-guardada"));
    } catch (error) { console.error("Error sincronizando configuración del negocio:", error); }
  }, 350);
}

function instalarSincronizacionNegocio() {
  if (negocioState.instalado || typeof window === "undefined") return;
  negocioState.instalado = true;
  const originalSetItem = Storage.prototype.setItem;
  if (!Storage.prototype.__haceCafeConfigPatch) {
    Storage.prototype.setItem = function (key, value) {
      const nextValue = key === "rs_dominio" ? normalizarDominio(value) : value;
      originalSetItem.call(this, key, nextValue);
      if (this === window.localStorage && NEGOCIO_KEYS.includes(key)) programarGuardadoNegocio();
    };
    Storage.prototype.__haceCafeConfigPatch = true;
  }

  const dominioActual = localStorage.getItem("rs_dominio");
  if (dominioActual) originalSetItem.call(localStorage, "rs_dominio", normalizarDominio(dominioActual));

  const token = localStorage.getItem("token");
  if (!token) return;
  fetch(`${API}/config/negocio`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || typeof data !== "object") return;
      negocioState.sincronizando = true;
      NEGOCIO_KEYS.forEach((key) => {
        if (data[key] !== undefined && data[key] !== null) originalSetItem.call(localStorage, key, key === "rs_dominio" ? normalizarDominio(data[key]) : String(data[key]));
      });
      negocioState.sincronizando = false;
      window.dispatchEvent(new Event("config-negocio-sincronizada"));
    })
    .catch(() => {});
}

instalarSincronizacionNegocio();

export function leerConfig() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return CONFIG_DEFAULT;
    return { ...CONFIG_DEFAULT, ...JSON.parse(raw) };
  } catch { return CONFIG_DEFAULT; }
}

export function guardarConfig(cfg) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
  const token = localStorage.getItem("token");
  if (!token) return Promise.resolve(cfg);
  return fetch(`${API}/config/apariencia`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cfg),
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "No se pudo guardar la apariencia");
    const completa = { ...CONFIG_DEFAULT, ...data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(completa));
    window.dispatchEvent(new Event("menu-apariencia-guardada"));
    return completa;
  });
}

export function useMenuConfig() {
  const [cfg, setCfg] = useState(leerConfig);
  useEffect(() => {
    let vivo = true;
    fetch(`${API}/config/apariencia`).then((r) => (r.ok ? r.json() : null)).then((data) => {
      if (!vivo || !data || typeof data !== "object") return;
      const completa = { ...CONFIG_DEFAULT, ...data };
      setCfg(completa); localStorage.setItem(CACHE_KEY, JSON.stringify(completa));
    }).catch(() => {});
    const actualizar = () => setCfg(leerConfig());
    window.addEventListener("storage", actualizar); window.addEventListener("menu-apariencia-guardada", actualizar);
    return () => { vivo = false; window.removeEventListener("storage", actualizar); window.removeEventListener("menu-apariencia-guardada", actualizar); };
  }, []);
  return cfg;
}

export function getFuente(id) { return (FUENTES_DISPONIBLES.find((f) => f.id === id) || FUENTES_DISPONIBLES[0]).css; }
export function cargarFuente(id) {
  const fuente = FUENTES_DISPONIBLES.find((f) => f.id === id);
  if (!fuente || !fuente.google || typeof document === "undefined") return;
  const linkId = `gf-${fuente.id}`; if (document.getElementById(linkId)) return;
  const link = document.createElement("link"); link.id = linkId; link.rel = "stylesheet"; link.href = `https://fonts.googleapis.com/css2?family=${fuente.google}&display=swap`; document.head.appendChild(link);
}
function hexARgb(hex, respaldo = "#000000") { const valido = /^#[0-9a-f]{6}$/i.test(hex || "") ? hex : respaldo; return [parseInt(valido.slice(1, 3), 16), parseInt(valido.slice(3, 5), 16), parseInt(valido.slice(5, 7), 16)]; }
export function hexToRgba(hex, alpha) { const [r, g, b] = hexARgb(hex); return `rgba(${r},${g},${b},${alpha})`; }
export function mezclar(a, b, t) { const A = hexARgb(a); const B = hexARgb(b); const m = A.map((v, i) => Math.round(v * (1 - t) + B[i] * t)); return `rgb(${m.join(",")})`; }
function luminancia(hex) { const [r, g, b] = hexARgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function textoSobre(hex) { const L = luminancia(hex); const conBlanco = 1.05 / (L + 0.05); const conOscuro = (L + 0.05) / 0.055; return conOscuro >= conBlanco ? "#14110d" : "#ffffff"; }
export function buildPaleta(cfg) {
  const primario = cfg.colorPrimario || CONFIG_DEFAULT.colorPrimario, fondo = cfg.colorFondo || CONFIG_DEFAULT.colorFondo, card = cfg.colorCard || CONFIG_DEFAULT.colorCard, texto = cfg.colorTexto || CONFIG_DEFAULT.colorTexto;
  const claro = luminancia(fondo) > 0.5;
  return { primario, fondo, card, texto, claro, sobrePrimario: textoSobre(primario), textoSuave: hexToRgba(texto, 0.66), textoTenue: hexToRgba(texto, 0.46), borde: hexToRgba(texto, claro ? 0.12 : 0.1), bordePrimario: hexToRgba(primario, 0.45), primarioSuave: hexToRgba(primario, 0.16), vidrio: hexToRgba(fondo, 0.82), sombra: claro ? "0 10px 30px rgba(20,20,20,0.10)" : "0 10px 30px rgba(0,0,0,0.45)", ok: "#3fa66b", info: "#4a8bcc", error: "#d9534f" };
}
