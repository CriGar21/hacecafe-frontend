import { useState, useRef } from "react";
import { useTema } from "../context/ThemeContext";

const CLOUD_NAME = "du2up0hl9";
const UPLOAD_PRESET = "hacecafe_productos";

export default function ImageUploader({ value, onChange }) {
  const { tema } = useTema();
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [modoUrl, setModoUrl] = useState(false);

  const subirImagen = async (archivo) => {
    if (!archivo) return;

    // Validar tipo y tamaño
    if (!archivo.type.startsWith("image/")) {
      setError("El archivo debe ser una imagen");
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5MB");
      return;
    }

    setSubiendo(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", archivo);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "hacecafe");

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) throw new Error("Error al subir la imagen");

      const data = await res.json();
      onChange(data.secure_url);
    } catch (err) {
      setError("No se pudo subir la imagen. Intentá de nuevo.");
    } finally {
      setSubiendo(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const archivo = e.dataTransfer.files[0];
    if (archivo) subirImagen(archivo);
  };

  const handleDragOver = (e) => e.preventDefault();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Preview */}
      {value && !modoUrl && (
        <div style={{ position: "relative", width: "100%", maxWidth: "200px" }}>
          <img
            src={value}
            alt="Preview"
            style={{
              width: "100%",
              height: "120px",
              objectFit: "cover",
              borderRadius: "10px",
              border: `1px solid ${tema.borderFaded}`,
              display: "block",
            }}
            onError={() => setError("No se pudo cargar la imagen")}
          />
          <button
            style={{
              position: "absolute",
              top: "6px",
              right: "6px",
              background: "rgba(0,0,0,0.6)",
              border: "none",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              color: "#fff",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => onChange("")}
            title="Quitar imagen"
          >
            ✕
          </button>
        </div>
      )}

      {/* Zona de drop o botón */}
      {!modoUrl && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            border: `2px dashed ${subiendo ? tema.accent : tema.borderFaded}`,
            borderRadius: "10px",
            padding: "20px",
            textAlign: "center",
            cursor: subiendo ? "not-allowed" : "pointer",
            background: subiendo ? `${tema.accent}08` : tema.inputBg,
            transition: "all 0.2s",
          }}
          onClick={() => !subiendo && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => subirImagen(e.target.files[0])}
          />
          {subiendo ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                border: `3px solid ${tema.borderFaded}`,
                borderTop: `3px solid ${tema.accent}`,
                animation: "spin 0.8s linear infinite",
              }} />
              <span style={{ fontSize: "13px", color: tema.textFaded }}>Subiendo imagen...</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
              <span style={{ fontSize: "24px" }}>🖼️</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: tema.text }}>
                {value ? "Cambiar imagen" : "Subir imagen"}
              </span>
              <span style={{ fontSize: "11px", color: tema.textFaded }}>
                Hacé clic o arrastrá un archivo · JPG, PNG, WEBP · máx 5MB
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <span style={{ fontSize: "12px", color: tema.alertaText }}>{error}</span>
      )}

      {/* Toggle URL manual */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          style={{
            background: "transparent",
            border: "none",
            fontSize: "12px",
            color: tema.textFaded,
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
          onClick={() => { setModoUrl(!modoUrl); setError(null); }}
        >
          {modoUrl ? "← Volver a subir archivo" : "O pegá una URL de imagen"}
        </button>
      </div>

      {/* Input URL manual */}
      {modoUrl && (
        <input
          type="text"
          placeholder="https://ejemplo.com/imagen.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            border: `1px solid ${tema.borderFaded}`,
            fontSize: "14px",
            fontFamily: "inherit",
            background: tema.inputBg,
            color: tema.text,
            width: "100%",
            boxSizing: "border-box",
          }}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}