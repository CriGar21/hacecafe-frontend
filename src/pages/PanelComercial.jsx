import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTema } from "../context/ThemeContext";
import SelectorTema from "../components/SelectorTema";
import api from "../services/api";
import "../admin.css";
import "./panelComercial.css";

const nuevaPromo = () => ({ nombre: "", descripcion: "", imagenUrl: "", tipo: "DESCUENTO", valor: 10, activa: true, mostrarMenu: true, desde: "", hasta: "" });
const dinero = n => "$" + Number(n || 0).toLocaleString("es-AR");
const fechaInput = value => value ? new Date(value).toISOString().slice(0, 16) : "";

export default function PanelComercial() {
  const { logout } = useAuth();
  const { tema } = useTema();
  const [promos, setPromos] = useState([]);
  const [juego, setJuego] = useState(null);
  const [form, setForm] = useState(nuevaPromo);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = async () => {
    try {
      const [p, j] = await Promise.all([api.get("/comercial/promociones/admin"), api.get("/juegos")]);
      setPromos(p.data);
      setJuego(j.data);
      setError("");
    } catch { setError("No se pudo cargar la configuración. Revisá la conexión e intentá nuevamente."); }
  };
  useEffect(() => { cargar(); }, []);

  const guardarPromo = async e => {
    e.preventDefault();
    setCargando(true); setError(""); setMensaje("");
    try {
      const payload = { ...form, valor: Number(form.valor), desde: form.desde || null, hasta: form.hasta || null };
      if (!payload.nombre.trim()) throw new Error("El nombre de la promoción es obligatorio.");
      if (payload.valor < 0 || !Number.isFinite(payload.valor)) throw new Error("El valor debe ser un número positivo.");
      if (payload.desde && payload.hasta && new Date(payload.hasta) < new Date(payload.desde)) throw new Error("La fecha de fin debe ser posterior al inicio.");
      if (editando) await api.patch(`/comercial/promociones/${editando}`, payload);
      else await api.post("/comercial/promociones", payload);
      setForm(nuevaPromo()); setEditando(null); setMensaje(editando ? "Promoción actualizada." : "Promoción creada.");
      await cargar();
    } catch (e2) { setError(e2.response?.data?.error || e2.message || "No se pudo guardar la promoción."); }
    finally { setCargando(false); }
  };

  const editarPromo = p => {
    setEditando(p.id);
    setForm({ nombre: p.nombre || "", descripcion: p.descripcion || "", imagenUrl: p.imagenUrl || "", tipo: p.tipo || "DESCUENTO", valor: Number(p.valor || 0), activa: Boolean(p.activa), mostrarMenu: Boolean(p.mostrarMenu), desde: fechaInput(p.desde), hasta: fechaInput(p.hasta) });
    setMensaje(""); setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const togglePromo = async p => {
    setError(""); setMensaje("");
    try { await api.patch(`/comercial/promociones/${p.id}`, { activa: !p.activa }); await cargar(); setMensaje(p.activa ? "Promoción pausada." : "Promoción activada."); }
    catch (e) { setError(e.response?.data?.error || "No se pudo actualizar la promoción."); }
  };
  const guardarJuego = async () => {
    setError(""); setMensaje("");
    const total = (juego?.premios || []).reduce((s, p) => s + Number(p.probabilidad || 0), 0);
    if (!juego?.premios?.length || juego.premios.some(p => Number(p.valor) < 0 || Number(p.probabilidad) < 0) || total <= 0) {
      setError("Configurá al menos un premio y una probabilidad total mayor que cero."); return;
    }
    try { await api.patch("/juegos", juego); setMensaje("Configuración del juego guardada."); await cargar(); }
    catch (e) { setError(e.response?.data?.error || "No se pudo guardar el juego."); }
  };
  const cambiarPremio = (i, campo, valor) => setJuego(j => ({ ...j, premios: j.premios.map((p, n) => n === i ? { ...p, [campo]: Number(valor) } : p) }));
  const totalProbabilidad = useMemo(() => (juego?.premios || []).reduce((s, p) => s + Number(p.probabilidad || 0), 0), [juego]);

  return <div className="commercial-shell">
    <header className="commercial-header"><div><strong>HaceCafé</strong><span>Administración comercial</span></div><div><SelectorTema/><button onClick={logout}>Salir</button></div></header>
    <main className="commercial-main">
      <div className="commercial-heading"><div><small>ADMINISTRACIÓN</small><h1>Promociones, descuentos y juegos</h1><p>Armá las campañas ahora; las imágenes y el diseño visual se pueden ir ajustando después.</p></div></div>
      {error && <div className="commercial-alert error" role="alert">{error}</div>}
      {mensaje && <div className="commercial-alert success" role="status">{mensaje}</div>}
      <section className="commercial-grid">
        <div className="commercial-card">
          <div className="card-title"><div><small>CAMPAÑAS DEL MENÚ</small><h2>{editando ? "Editar promoción" : "Crear promoción"}</h2></div></div>
          <form className="promo-form" onSubmit={guardarPromo}>
            <label>Nombre<input required maxLength="120" placeholder="Ej. Merienda para dos" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label>
            <label>Descripción<textarea rows="3" placeholder="Qué incluye y cuáles son las condiciones" value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></label>
            <label>Imagen de la promoción (URL)<input type="url" placeholder="https://... (podés agregarla más adelante)" value={form.imagenUrl} onChange={e=>setForm({...form,imagenUrl:e.target.value})}/></label>
            {form.imagenUrl && <div className="promo-preview"><img src={form.imagenUrl} alt="Vista previa de la promoción" onError={e=>{e.currentTarget.style.display="none"}}/><span>Vista previa</span></div>}
            <div className="promo-form-two">
              <label>Tipo<select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}><option value="DESCUENTO">Descuento porcentual (%)</option><option value="MONTO_FIJO">Descuento fijo ($)</option><option value="COMBO">Combo / precio especial</option><option value="2X1">2x1</option><option value="REGALO">Producto de regalo</option><option value="INFORMATIVA">Solo comunicar</option></select></label>
              <label>{form.tipo==="MONTO_FIJO"||form.tipo==="COMBO"?"Valor ($)":"Valor (%)"}<input type="number" min="0" step="0.01" value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})}/></label>
            </div>
            <div className="promo-form-two"><label>Desde<input type="datetime-local" value={form.desde} onChange={e=>setForm({...form,desde:e.target.value})}/></label><label>Hasta<input type="datetime-local" value={form.hasta} onChange={e=>setForm({...form,hasta:e.target.value})}/></label></div>
            <div className="promo-checks"><label><input type="checkbox" checked={form.activa} onChange={e=>setForm({...form,activa:e.target.checked})}/> Activada</label><label><input type="checkbox" checked={form.mostrarMenu} onChange={e=>setForm({...form,mostrarMenu:e.target.checked})}/> Mostrar en el menú del cliente</label></div>
            <div className="promo-actions"><button className="save-game" disabled={cargando}>{cargando?"Guardando…":editando?"Guardar cambios":"Crear promoción"}</button>{editando&&<button type="button" className="secondary-btn" onClick={()=>{setForm(nuevaPromo());setEditando(null)}}>Cancelar edición</button>}</div>
          </form>
          <div className="promo-list"><div className="list-heading"><h3>Promociones creadas</h3><span>{promos.length} en total</span></div>
            {promos.map(p=><article key={p.id} className="promo-row">
              {p.imagenUrl?<img className="promo-thumb" src={p.imagenUrl} alt="" onError={e=>{e.currentTarget.style.visibility="hidden"}}/>:<div className="promo-thumb placeholder">HC</div>}
              <div className="promo-details"><strong>{p.nombre}</strong><p>{p.descripcion||"Sin descripción"}</p><small>{p.tipo} · {p.tipo==="MONTO_FIJO"||p.tipo==="COMBO"?dinero(p.valor):p.tipo==="INFORMATIVA"?"Informativa":`${p.valor}%`}</small><div className="promo-flags"><span className={p.activa?"status on":"status"}>{p.activa?"ACTIVA":"PAUSADA"}</span><span className={p.mostrarMenu?"status on":"status"}>{p.mostrarMenu?"VISIBLE EN MENÚ":"OCULTA"}</span></div></div>
              <div className="promo-row-actions"><button onClick={()=>editarPromo(p)}>Editar</button><button onClick={()=>togglePromo(p)}>{p.activa?"Pausar":"Activar"}</button></div>
            </article>)}
            {!promos.length&&<div className="commercial-empty">Todavía no hay promociones. Creá una para empezar.</div>}
          </div>
        </div>
        <div className="commercial-card">
          <div className="card-title"><div><small>EXPERIENCIA DEL CLIENTE</small><h2>Juego de espera</h2></div><label className="switch"><input type="checkbox" checked={Boolean(juego?.activo)} onChange={e=>setJuego({...juego,activo:e.target.checked})}/><span/></label></div>
          {juego&&<><p className="help">El cliente puede jugar mientras espera. El servidor elige el premio; el porcentaje se aplica al pedido una sola vez.</p>
            <label className="field-label">Nombre del juego<input maxLength="100" value={juego.nombre||""} onChange={e=>setJuego({...juego,nombre:e.target.value})}/></label>
            <div className="prize-table"><div className="prize-head"><span>Descuento</span><span>Probabilidad</span></div>{(juego.premios||[]).map((p,i)=><div className="prize-row" key={i}><input aria-label={`Porcentaje premio ${i+1}`} type="number" min="0" max="100" step="1" value={p.valor} onChange={e=>cambiarPremio(i,"valor",e.target.value)}/><span>%</span><input aria-label={`Probabilidad premio ${i+1}`} type="number" min="0" step="1" value={p.probabilidad} onChange={e=>cambiarPremio(i,"probabilidad",e.target.value)}/><span>%</span></div>)}</div>
            <div className="prob-total"><span>Total de probabilidades</span><strong className={Math.abs(totalProbabilidad-100)<0.001?"valid":"warn"}>{totalProbabilidad}%</strong></div>
            <p className="help">Las probabilidades se ponderan entre sí; recomendación: sumarlas hasta 100% para que sea fácil auditarlas.</p>
            <button className="save-game" onClick={guardarJuego}>Guardar configuración del juego</button>
          </>}
          <div className="commercial-note"><strong>Próximo paso visual</strong><p>Después diseñamos las imágenes de cada promoción y la ruleta para que coincidan con la identidad de HaceCafé.</p></div>
        </div>
      </section>
    </main>
  </div>;
}
