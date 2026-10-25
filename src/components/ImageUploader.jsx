import { useState, useRef } from "react";
import { useTema } from "../context/ThemeContext";

const CLOUD_NAME = "du2up0hl9";
const UPLOAD_PRESET = "hacecafe_productos";

function ImageGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="hc-upload-glyph"><rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7"/><circle cx="8" cy="9" r="1.6" fill="currentColor"/><path d="M4.5 17l5-5 3.3 3.2 2.1-2.1 4.6 4.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function CloseGlyph() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" className="hc-upload-close"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}

export default function ImageUploader({ value, onChange }) {
  const { tema } = useTema();
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [modoUrl, setModoUrl] = useState(false);

  const subirImagen = async (archivo) => {
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) { setError("El archivo debe ser una imagen"); return; }
    if (archivo.size > 5 * 1024 * 1024) { setError("La imagen no puede superar 5MB"); return; }
    setSubiendo(true); setError(null);
    try {
      const formData = new FormData();
      formData.append("file", archivo);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "hacecafe");
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Error al subir la imagen");
      const data = await res.json();
      onChange(data.secure_url);
    } catch { setError("No se pudo subir la imagen. Intentá de nuevo."); }
    finally { setSubiendo(false); }
  };

  const handleDrop = (e) => { e.preventDefault(); const archivo = e.dataTransfer.files[0]; if (archivo) subirImagen(archivo); };
  const handleDragOver = (e) => e.preventDefault();

  return (
    <div className="hc-image-uploader" style={{ "--hc-upload-accent": tema.accent, "--hc-upload-border": tema.borderFaded, "--hc-upload-bg": tema.inputBg }}>
      {value && !modoUrl && (
        <div className="hc-image-preview">
          <img src={value} alt="Vista previa" onError={() => setError("No se pudo cargar la imagen")} />
          <div className="hc-image-preview-overlay">
            <span>Vista previa</span>
            <button type="button" className="hc-image-remove" onClick={() => onChange("")} aria-label="Quitar imagen" title="Quitar imagen"><CloseGlyph /></button>
          </div>
        </div>
      )}

      {!modoUrl && (
        <div className={`hc-image-dropzone${subiendo ? " is-uploading" : ""}${value ? " has-preview" : ""}`} onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => !subiendo && inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !subiendo) inputRef.current?.click(); }}>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { subirImagen(e.target.files[0]); e.target.value = ""; }} />
          {subiendo ? (
            <div className="hc-image-upload-loading"><span className="hc-upload-spinner"/><span>Subiendo imagen...</span></div>
          ) : (
            <div className="hc-image-upload-copy">
              <span className="hc-upload-icon"><ImageGlyph /></span>
              <strong>{value ? "Cambiar imagen" : "Subir imagen"}</strong>
              <span>Arrastrá una imagen o seleccioná un archivo</span>
              <small>JPG · PNG · WEBP · máximo 5 MB</small>
            </div>
          )}
        </div>
      )}

      {error && <span className="hc-image-upload-error">{error}</span>}

      <button type="button" className="hc-image-url-toggle" onClick={() => { setModoUrl(!modoUrl); setError(null); }}>
        {modoUrl ? "Volver a subir archivo" : "Usar URL de imagen"}
      </button>

      {modoUrl && (
        <div className="hc-image-url-row">
          <input type="text" placeholder="https://ejemplo.com/imagen.jpg" value={value || ""} onChange={(e) => onChange(e.target.value)} />
          {value && <img src={value} alt="Miniatura" onError={() => setError("La URL no corresponde a una imagen válida")} />}
        </div>
      )}
    </div>
  );
}
