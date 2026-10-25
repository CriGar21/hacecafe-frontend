import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useTema } from "../context/ThemeContext";
import api from "../services/api";
import Ticket from "../components/Ticket";
import PantallaPago from "../components/PantallaPago";
import SelectorTema from "../components/SelectorTema";

const TABS = ["Cargar pedido", "Solicitudes", "Mis pedidos", "Cobrar"];

const COLORES_ESTADO = {
  ESPERANDO_APROBACION: { label: "Esperando aprobación" },
  PENDIENTE: { label: "Pendiente" },
  EN_PREPARACION: { label: "En preparación" },
  LISTO: { label: "Listo" },
  ENTREGADO: { label: "Entregado" },
  COBRADO: { label: "Cobrado" },
  CANCELADO: { label: "Cancelado" },
};

const COLOR_ESTADO_TEXT = {
  ESPERANDO_APROBACION: "#C8913A",
  PENDIENTE: "#F5D78E",
  EN_PREPARACION: "#85B7EB",
  LISTO: "#7ec87e",
  ENTREGADO: "#888",
  COBRADO: "#90e090",
  CANCELADO: "#e07070",
};

export default function PantallaEmpleado() {
  const { usuario, logout } = useAuth();
  const { tema } = useTema();
  const st = getStyles(tema);

  const [tab, setTab] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [mesa, setMesa] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [misPedidos, setMisPedidos] = useState([]);
  const [busquedaCobro, setBusquedaCobro] = useState("");
  const [tipoBusqueda, setTipoBusqueda] = useState("mesa");
  const [pedidosCobro, setPedidosCobro] = useState([]);
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [cobrando, setCobrando] = useState(false);
  const [cobrado, setCobrado] = useState(null);
  const [pantallaPago, setPantallaPago] = useState(null);
  const [ticketCobro, setTicketCobro] = useState(null);
  const [fechaHistorial, setFechaHistorial] = useState(() => new Date().toISOString().split("T")[0]);
  const [ticketsDelDia, setTicketsDelDia] = useState([]);
  const [buscandoHistorial, setBuscandoHistorial] = useState(false);
  const [ticketHistorial, setTicketHistorial] = useState(null);
  const [historialCargado, setHistorialCargado] = useState(false);
  const [verStock, setVerStock] = useState(false);
  const [stockProductos, setStockProductos] = useState([]);
  const [cantStock, setCantStock] = useState({});
  const [guardandoStock, setGuardandoStock] = useState({});

  const cargarPedidos = useCallback(() => {
    api.get("/pedidos").then((r) => setMisPedidos(r.data.filter((p) => !["COBRADO", "CANCELADO"].includes(p.estado) && !p.cobrado))).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/pedidos").then((r) => setSolicitudes(r.data.filter((p) => p.estado === "ESPERANDO_APROBACION"))).catch(() => {});
    api.get("/categorias").then((r) => { setCategorias(r.data); if (r.data.length) setCategoriaActiva(r.data[0].id); }).catch(() => {});
    api.get("/productos").then((r) => setProductos(r.data)).catch(() => {});
    cargarPedidos();
    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3001", { transports: ["websocket"], reconnection: true });
    socket.on("solicitud_cliente", (p) => setSolicitudes((prev) => [p, ...prev]));
    socket.on("pedido_aprobado", (p) => setSolicitudes((prev) => prev.filter((x) => x.id !== p.id)));
    socket.on("pedido_rechazado", ({ pedidoId }) => setSolicitudes((prev) => prev.filter((x) => x.id !== pedidoId)));
    socket.on("nuevo_pedido", (p) => setMisPedidos((prev) => prev.find((x) => x.id === p.id) ? prev : [p, ...prev]));
    socket.on("pedido_actualizado", (act) => setMisPedidos((prev) => prev.map((p) => p.id === act.id ? act : p)));
    socket.on("mesa_cobrada", ({ pedidoIds }) => setMisPedidos((prev) => prev.filter((p) => !pedidoIds.includes(p.id))));
    return () => socket.disconnect();
  }, [cargarPedidos]);

  const productosFiltrados = productos.filter((p) => busqueda ? p.nombre.toLowerCase().includes(busqueda.toLowerCase()) : p.categoriaId === categoriaActiva);
  const agregarAlCarrito = (producto) => setCarrito((prev) => { const existe = prev.find((i) => i.id === producto.id); return existe ? prev.map((i) => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i) : [...prev, { ...producto, cantidad: 1 }]; });
  const quitarDelCarrito = (productoId) => setCarrito((prev) => { const item = prev.find((i) => i.id === productoId); if (!item) return prev; return item.cantidad === 1 ? prev.filter((i) => i.id !== productoId) : prev.map((i) => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i); });
  const totalCarrito = carrito.reduce((acc, i) => acc + Number(i.precio) * i.cantidad, 0);

  const confirmarPedido = async () => {
    if (!carrito.length) return;
    setEnviando(true);
    try {
      const { data } = await api.post("/pedidos", { mesa, notas, items: carrito.map((i) => ({ productoId: i.id, cantidad: i.cantidad })) });
      setConfirmado(data); setCarrito([]); setMesa(""); setNotas("");
      api.get("/productos").then((r) => setProductos(r.data)).catch(() => {});
    } catch (error) {
      const mensaje = error.response?.data?.error || "Error al enviar pedido";
      alert(mensaje);
      api.get("/productos").then((r) => setProductos(r.data)).catch(() => {});
    } finally { setEnviando(false); }
  };

  const irACobrarPedido = (pedido) => { setTipoBusqueda("numero"); setBusquedaCobro(String(pedido.numero)); setPedidosCobro([pedido]); setCobrado(null); setTab(3); };
  const buscarParaCobrar = async () => { if (!busquedaCobro.trim()) return; try { const { data } = await api.get(tipoBusqueda === "mesa" ? `/pedidos/mesa/${busquedaCobro}` : `/pedidos/numero/${busquedaCobro}`); setPedidosCobro(Array.isArray(data) ? data : [data]); setCobrado(null); } catch { alert("No se encontraron pedidos"); setPedidosCobro([]); } };
  const totalCobro = pedidosCobro.reduce((acc, p) => acc + Number(p.total), 0);
  const abrirPantallaPago = () => { if (!pedidosCobro.length) return; const pedido = pedidosCobro[0]; setPantallaPago({ numero: pedido?.numero || "", numeroPedido: busquedaCobro, mesa: pedido?.mesa || "", total: totalCobro || 0, items: pedidosCobro.flatMap((p) => p.items || []) }); };
  const confirmarPagoReal = async () => { setCobrando(true); try { const body = tipoBusqueda === "mesa" ? { mesa: busquedaCobro, metodoPago } : { numeroPedido: busquedaCobro, metodoPago }; const { data } = await api.post("/pedidos/cobrar", body); setCobrado(data); setPantallaPago(null); setPedidosCobro([]); setBusquedaCobro(""); setTicketCobro({ numero: data.pedidos?.[0]?.numero || "", mesa: data.mesa, creadoEn: new Date().toISOString(), total: data.totalCobrado, metodoPago, items: data.pedidos?.flatMap((p) => p.items || []) || [] }); } catch (error) { alert(error.response?.data?.error || "Error al cobrar"); } finally { setCobrando(false); } };
  const cargarStock = () => api.get("/admin/productos").then((r) => setStockProductos(r.data)).catch(() => {});
  const agregarStock = async (producto) => { const cantidad = Number(cantStock[producto.id]); if (!cantidad || cantidad <= 0) return; setGuardandoStock((p) => ({ ...p, [producto.id]: true })); try { await api.patch(`/admin/productos/${producto.id}/stock`, { cantidad, operacion: "agregar" }); setCantStock((p) => ({ ...p, [producto.id]: "" })); cargarStock(); } catch { alert("Error al actualizar stock"); } finally { setGuardandoStock((p) => ({ ...p, [producto.id]: false })); } };
  const buscarTicketsPorFecha = async () => { if (!fechaHistorial) return; setBuscandoHistorial(true); try { const { data } = await api.get(`/admin/caja?desde=${fechaHistorial}&hasta=${fechaHistorial}`); setTicketsDelDia(data.pedidos || []); setHistorialCargado(true); } catch { alert("Error al buscar tickets"); } finally { setBuscandoHistorial(false); } };

  const totalActivos = misPedidos.length;
  return (
    <div style={st.container}>
      <div style={st.header}><div><div style={st.headerNombre}>HaceCafe</div><div style={st.headerUsuario}>{usuario?.nombre} — {usuario?.rol === "DUENO" ? "Dueño" : usuario?.rol}</div></div><div style={{display:"flex",gap:"8px",alignItems:"center"}}><SelectorTema/><button style={st.btnLogout} onClick={()=>logout()}>Salir</button></div></div>
      <div style={st.tabs}>{TABS.map((t,i)=><button key={i} style={{...st.tab,...(tab===i?st.tabActivo:{})}} onClick={()=>{setTab(i);setConfirmado(null);setCobrado(null);}}>{t}{i===1&&solicitudes.length>0&&<span style={st.tabBadge}>{solicitudes.length}</span>}{i===2&&totalActivos>0&&<span style={st.tabBadge}>{totalActivos}</span>}</button>)}</div>
      {tab===0&&<div style={st.content}><h2 style={st.titulo}>Cargar pedido</h2><div style={st.toolbar}><input style={st.input} placeholder="Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/><select style={st.input} value={categoriaActiva||""} onChange={e=>setCategoriaActiva(Number(e.target.value))}><option value="">Todas</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.icono||"☕"} {c.nombre}</option>)}</select></div><div style={st.productos}>{productosFiltrados.map(p=><button key={p.id} style={st.producto} disabled={p.stockActual<=0} onClick={()=>agregarAlCarrito(p)}><span>{p.nombre}</span><strong>${Number(p.precio).toLocaleString("es-AR")}</strong><small>Stock: {p.stockActual}</small></button>)}</div><div style={st.carrito}><h3>Pedido</h3>{carrito.map(i=><div key={i.id} style={st.item}><span>{i.nombre} x{i.cantidad}</span><strong>${(Number(i.precio)*i.cantidad).toLocaleString("es-AR")}</strong><button onClick={()=>quitarDelCarrito(i.id)}>−</button></div>)}<input style={st.input} placeholder="Mesa" value={mesa} onChange={e=>setMesa(e.target.value)}/><textarea style={st.input} placeholder="Notas" value={notas} onChange={e=>setNotas(e.target.value)}/><button style={st.btnPrimario} disabled={enviando||!carrito.length} onClick={confirmarPedido}>{enviando?"Enviando...":`Enviar pedido · $${totalCarrito.toLocaleString("es-AR")}`}</button></div>{confirmado&&<div style={st.confirmadoBox}>✓ Pedido #{confirmado.numero} enviado</div>}</div>}
      {tab===1&&<div style={st.content}><h2 style={st.titulo}>Solicitudes</h2>{solicitudes.map(p=><div key={p.id} style={st.pedido}><strong>Pedido #{p.numero} · Mesa {p.mesa||"-"}</strong><span>{COLORES_ESTADO[p.estado]?.label||p.estado}</span><div>{p.items?.map(i=><div key={i.id}>{i.producto?.nombre} x{i.cantidad}</div>)}</div><div style={st.acciones}><button onClick={async()=>{try{await api.patch(`/pedidos/${p.id}/aprobar`);cargarPedidos();setSolicitudes(x=>x.filter(y=>y.id!==p.id));}catch(e){alert(e.response?.data?.error||"Error al aprobar");}}}>Aprobar</button><button onClick={async()=>{try{await api.patch(`/pedidos/${p.id}/rechazar`);cargarPedidos();setSolicitudes(x=>x.filter(y=>y.id!==p.id));}catch(e){alert(e.response?.data?.error||"Error al rechazar");}}}>Rechazar</button></div></div>)}</div>}
      {tab===2&&<div style={st.content}><h2 style={st.titulo}>Mis pedidos</h2>{misPedidos.map(p=><div key={p.id} style={st.pedido}><strong>#{p.numero} · Mesa {p.mesa||"-"}</strong><span>{COLORES_ESTADO[p.estado]?.label||p.estado}</span><div>{p.items?.map(i=><div key={i.id}>{i.producto?.nombre} x{i.cantidad}</div>)}</div><button onClick={()=>irACobrarPedido(p)}>Cobrar</button></div>)}</div>}
      {tab===3&&<div style={st.content}><h2 style={st.titulo}>Cobrar</h2><div style={st.toolbar}><select style={st.input} value={tipoBusqueda} onChange={e=>setTipoBusqueda(e.target.value)}><option value="mesa">Mesa</option><option value="numero">Pedido</option></select><input style={st.input} value={busquedaCobro} onChange={e=>setBusquedaCobro(e.target.value)} placeholder="Número"/><button style={st.btnPrimario} onClick={buscarParaCobrar}>Buscar</button></div>{pedidosCobro.map(p=><div key={p.id} style={st.pedido}><strong>#{p.numero} · Mesa {p.mesa}</strong><div>{p.items?.map(i=><div key={i.id}>{i.producto?.nombre} x{i.cantidad}</div>)}</div></div>)}{pedidosCobro.length>0&&<><div style={st.total}>Total: ${totalCobro.toLocaleString("es-AR")}</div><select style={st.input} value={metodoPago} onChange={e=>setMetodoPago(e.target.value)}><option>EFECTIVO</option><option>QR</option><option>TRANSFERENCIA</option><option>TARJETA</option></select><button style={st.btnPrimario} disabled={cobrando} onClick={abrirPantallaPago}>Continuar</button></>}{pantallaPago&&<PantallaPago {...pantallaPago} metodoPago={metodoPago} onConfirmar={confirmarPagoReal} onCancelar={()=>setPantallaPago(null)} cargando={cobrando}/>} {ticketCobro&&<Ticket pedido={ticketCobro}/>}</div>}
    </div>
  );
}

function getStyles(t){return{container:{minHeight:"100vh",background:t.bg,color:t.text,padding:"1rem",boxSizing:"border-box"},header:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"},headerNombre:{fontSize:"1.4rem",fontWeight:"800",color:t.gold},headerUsuario:{fontSize:"12px",color:t.textFaded},btnLogout:{background:"transparent",border:`1px solid ${t.borderFaded}`,color:t.text,padding:"8px 12px",borderRadius:"8px",cursor:"pointer"},tabs:{display:"flex",gap:"6px",overflowX:"auto",marginBottom:"1rem"},tab:{background:t.bgCard,color:t.text,border:`1px solid ${t.borderFaded}`,padding:"9px 12px",borderRadius:"8px",cursor:"pointer"},tabActivo:{background:t.gold,color:t.bg,borderColor:t.gold},tabBadge:{marginLeft:"6px",background:t.alertaText,color:t.bg,borderRadius:"10px",padding:"2px 6px",fontSize:"10px"},content:{display:"flex",flexDirection:"column",gap:"12px"},titulo:{color:t.gold},toolbar:{display:"flex",gap:"8px",flexWrap:"wrap"},input:{padding:"10px",borderRadius:"8px",border:`1px solid ${t.borderFaded}`,background:t.inputBg,color:t.text},productos:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"10px"},producto:{display:"flex",flexDirection:"column",gap:"5px",padding:"14px",borderRadius:"10px",border:`1px solid ${t.borderFaded}`,background:t.bgCard,color:t.text,cursor:"pointer",textAlign:"left"},carrito:{display:"flex",flexDirection:"column",gap:"8px",padding:"14px",background:t.bgCard,borderRadius:"12px"},item:{display:"flex",gap:"10px",alignItems:"center",justifyContent:"space-between"},btnPrimario:{background:t.gold,color:t.bg,border:"none",borderRadius:"8px",padding:"10px 14px",fontWeight:"700",cursor:"pointer"},confirmadoBox:{padding:"14px",background:`${t.verde}20`,borderRadius:"10px"},pedido:{padding:"14px",background:t.bgCard,borderRadius:"10px",display:"flex",flexDirection:"column",gap:"8px"},acciones:{display:"flex",gap:"8px"},total:{fontSize:"1.3rem",fontWeight:"800",color:t.gold}};}
