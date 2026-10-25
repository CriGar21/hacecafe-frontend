import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SOCKET = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const ORDER_KEY = "hc_cliente_pedido";
const css = `
.hc-flow-actions{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}.hc-flow-actions button,.hc-flow-notice button{border:1px solid rgba(200,145,58,.35);background:rgba(200,145,58,.09);color:inherit;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}.hc-flow-actions button.primary,.hc-flow-notice button.primary{background:#c8913a;color:#17110c}.hc-flow-actions button.danger,.hc-flow-notice button.danger{border-color:rgba(200,90,90,.4);background:rgba(200,90,90,.09);color:#e9aaa0}.hc-flow-note{font-size:12px;opacity:.7;margin-top:8px}.hc-flow-modal{position:fixed;inset:0;z-index:99999;background:rgba(8,6,5,.72);display:grid;place-items:center;padding:18px}.hc-flow-panel{width:min(560px,100%);max-height:90vh;overflow:auto;background:#17120e;color:#f4eadb;border:1px solid rgba(200,145,58,.28);border-radius:18px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.45)}.hc-flow-panel h3{margin:0 0 5px;font:700 24px Georgia,serif}.hc-flow-panel p{margin:0 0 18px;opacity:.7;font-size:13px}.hc-flow-row{display:grid;grid-template-columns:1fr auto auto auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.08)}.hc-flow-row small{opacity:.65}.hc-flow-row button{width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:transparent;color:inherit;cursor:pointer}.hc-flow-add{margin-top:15px;width:100%;padding:10px;border-radius:10px;background:transparent;border:1px dashed rgba(200,145,58,.4);color:#dcb77b;cursor:pointer}.hc-flow-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}.hc-flow-modal-actions button{padding:10px 15px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:transparent;color:inherit;cursor:pointer}.hc-flow-modal-actions .primary{background:#c8913a;color:#17110c;border-color:#c8913a}.hc-flow-notice{position:fixed;right:18px;top:18px;z-index:99998;width:min(390px,calc(100vw - 36px));background:#17120e;color:#f4eadb;border:1px solid rgba(200,145,58,.35);border-radius:16px;padding:16px;box-shadow:0 18px 55px rgba(0,0,0,.38)}.hc-flow-notice strong{display:block;margin-bottom:5px}.hc-flow-notice p{font-size:12px;opacity:.72;margin:5px 0 12px}.hc-flow-notice-actions{display:flex;gap:8px}.hc-admin-return{position:fixed;left:18px;bottom:18px;z-index:99990;border:1px solid rgba(200,145,58,.4);background:#17120e;color:#f4eadb;border-radius:12px;padding:11px 15px;font-weight:800;cursor:pointer;box-shadow:0 12px 35px rgba(0,0,0,.3)}
`;

function styleOnce(){if(document.getElementById("hc-flow-style"))return;const s=document.createElement("style");s.id="hc-flow-style";s.textContent=css;document.head.appendChild(s)}
function getOrder(){try{return JSON.parse(localStorage.getItem(ORDER_KEY)||"null")}catch{return null}}
function setOrder(p){localStorage.setItem(ORDER_KEY,JSON.stringify(p))}
function auth(){const t=localStorage.getItem("token");return t?{Authorization:`Bearer ${t}`,"Content-Type":"application/json"}:{"Content-Type":"application/json"}}
function money(n){return `$${Number(n||0).toLocaleString("es-AR")}`}

function installFetchCapture(){
  if(window.__hcFetchCapture)return; window.__hcFetchCapture=true; const original=window.fetch.bind(window);
  window.fetch=async(...args)=>{const response=await original(...args);try{const url=typeof args[0]==="string"?args[0]:args[0]?.url||"";if(url.includes("/pedidos/publico")&&response.ok&&!url.includes("/modificar")&&!url.includes("/cancelar")){const data=await response.clone().json();if(data?.id&&data?.clienteToken)setOrder(data)}}catch{}return response};
}

function removeExisting(id){document.getElementById(id)?.remove()}
function renderSummary(order,root){const rows=root.querySelectorAll(".mc-resumen-row");rows.forEach(r=>r.remove());const total=root.querySelector(".mc-resumen-total");if(!total)return;for(const item of order.items||[]){const row=document.createElement("div");row.className="mc-resumen-row";row.innerHTML=`<span>${item.cantidad} × ${item.producto?.nombre||"Producto"}</span><span>${money(item.subtotal)}</span>`;root.insertBefore(row,total)}const b=total.querySelector("b");if(b)b.textContent=money(order.total)}

async function openEditor(order){
  removeExisting("hc-flow-modal");
  const modal=document.createElement("div");modal.id="hc-flow-modal";modal.className="hc-flow-modal";
  const panel=document.createElement("div");panel.className="hc-flow-panel";panel.innerHTML=`<h3>Modificar pedido</h3><p>Podés corregir cantidades, quitar productos o sumar otro. Mientras el pedido espera confirmación, el cambio se aplica directamente.</p><div id="hc-edit-list"></div><select id="hc-edit-add" class="hc-flow-add"><option value="">Agregar producto</option></select><div class="hc-flow-modal-actions"><button id="hc-edit-close">Cerrar</button><button id="hc-edit-save" class="primary">Guardar cambios</button></div>`;modal.appendChild(panel);document.body.appendChild(modal);
  const list=panel.querySelector("#hc-edit-list");let items=(order.items||[]).map(i=>({producto:i.producto,cantidad:i.cantidad,notas:i.notas||""}));
  const render=()=>{list.innerHTML="";items.forEach((i,idx)=>{const r=document.createElement("div");r.className="hc-flow-row";r.innerHTML=`<div><strong>${i.producto?.nombre||"Producto"}</strong><br><small>${money(i.producto?.precio)}</small></div><button data-a="-" data-i="${idx}">−</button><strong>${i.cantidad}</strong><button data-a="+" data-i="${idx}">+</button>`;list.appendChild(r)})};render();
  try{const products=await fetch(`${API}/productos`).then(r=>r.json());const select=panel.querySelector("#hc-edit-add");products.forEach(p=>{const o=document.createElement("option");o.value=p.id;o.textContent=`${p.nombre} — ${money(p.precio)}`;select.appendChild(o)});select.addEventListener("change",()=>{const p=products.find(x=>String(x.id)===select.value);if(p){const ex=items.find(x=>x.producto.id===p.id);if(ex)ex.cantidad++;else items.push({producto:p,cantidad:1,notas:""});select.value="";render()}})}catch{}
  list.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const i=items[Number(b.dataset.i)];if(!i)return;i.cantidad+=b.dataset.a==="+"?1:-1;if(i.cantidad<=0)items.splice(Number(b.dataset.i),1);render()});
  panel.querySelector("#hc-edit-close").onclick=()=>modal.remove();
  panel.querySelector("#hc-edit-save").onclick=async()=>{if(!items.length)return alert("El pedido debe tener al menos un producto.");const save=panel.querySelector("#hc-edit-save");save.disabled=true;try{const r=await fetch(`${API}/pedidos/publico/${order.id}/modificar`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:order.clienteToken,items:items.map(i=>({productoId:i.producto.id,cantidad:i.cantidad,notas:i.notas}))})});const data=await r.json();if(!r.ok)throw new Error(data.error||"No se pudo modificar");if(data.items){setOrder(data);const root=document.querySelector(".mc-resumen");if(root)renderSummary(data,root)}modal.remove();showInlineMessage(data.mensaje||"Cambios guardados.");}catch(e){alert(e.message)}finally{save.disabled=false}};
}
function showInlineMessage(text){removeExisting("hc-flow-inline");const el=document.createElement("div");el.id="hc-flow-inline";el.className="hc-flow-note";el.textContent=text;document.querySelector(".mc-track")?.appendChild(el);setTimeout(()=>el.remove(),5000)}
async function cancelOrder(order){if(!confirm("¿Querés cancelar este pedido?"))return;try{const r=await fetch(`${API}/pedidos/publico/${order.id}/cancelar`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:order.clienteToken})});const data=await r.json();if(!r.ok)throw new Error(data.error||"No se pudo cancelar");setOrder(data);showInlineMessage(data.mensaje||"Solicitud enviada.");const a=document.querySelector(".hc-flow-actions");if(a)a.remove();if(data.estado==="CANCELADO"){const h=document.querySelector(".mc-track h1");if(h)h.textContent="Pedido cancelado"}}catch(e){alert(e.message)}}

function installCustomerActions(){
  if(location.pathname!=="/menu")return;
  let last=null;
  const scan=()=>{const root=document.querySelector(".mc-track");const order=getOrder();if(!root||!order||last===order.id)return;if(document.querySelector(".hc-flow-actions"))return;last=order.id;const info=document.createElement("div");info.className="hc-flow-actions";const modify=document.createElement("button");modify.className="primary";modify.textContent="Modificar pedido";modify.onclick=()=>openEditor(getOrder());const cancel=document.createElement("button");cancel.className="danger";cancel.textContent="Cancelar pedido";cancel.onclick=()=>cancelOrder(getOrder());info.append(modify,cancel);root.appendChild(info);};
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});scan();
}

function installStaffRequests(){
  const role=(()=>{try{return JSON.parse(localStorage.getItem("usuario")||"null")?.rol}catch{return null}})();
  if(!["DUENO","EMPLEADO"].includes(role)||!location.pathname.startsWith("/empleado"))return;
  const socket=io(SOCKET,{transports:["websocket"],reconnection:true});
  const show=(type,p)=>{removeExisting("hc-flow-notice");const n=document.createElement("div");n.id="hc-flow-notice";n.className="hc-flow-notice";const title=type==="cancel"?"Solicitud de cancelación":"Solicitud de modificación";const body=type==="cancel"?`Pedido #${p.numero}: el cliente pidió cancelar el pedido.`:`Pedido #${p.numero}: el cliente pidió modificar los productos.`;n.innerHTML=`<strong>${title}</strong><p>${body}</p><div class="hc-flow-notice-actions"><button class="primary" id="hc-flow-ok">Aprobar</button><button class="danger" id="hc-flow-no">Rechazar</button></div>`;document.body.appendChild(n);const endpoint=type==="cancel"?`/pedidos/${p.id}/cancelacion`:`/pedidos/${p.id}/modificacion`;n.querySelector("#hc-flow-ok").onclick=()=>resolve(endpoint+"/aprobar",true);n.querySelector("#hc-flow-no").onclick=()=>resolve(endpoint+"/rechazar",false)};
  async function resolve(path){const r=await fetch(`${API}${path}`,{method:"PATCH",headers:auth()});if(r.ok)removeExisting("hc-flow-notice");else{const d=await r.json().catch(()=>({}));alert(d.error||"No se pudo resolver la solicitud")}}
  socket.on("solicitud_cancelacion",p=>show("cancel",p));socket.on("solicitud_modificacion",p=>show("modify",p));
  window.addEventListener("beforeunload",()=>socket.disconnect());
}

function installAdminReturn(){
  let u=null;try{u=JSON.parse(localStorage.getItem("usuario")||"null")}catch{}if(u?.rol!=="DUENO"||location.pathname!=="/empleado")return;if(document.getElementById("hc-admin-return"))return;const b=document.createElement("button");b.id="hc-admin-return";b.className="hc-admin-return";b.textContent="Volver al admin";b.onclick=()=>{location.href="/admin"};document.body.appendChild(b)}

function installQRFix(){
  const apply=()=>document.querySelectorAll('svg[id^="qr-mesa-"]').forEach(svg=>{svg.setAttribute("shape-rendering","crispEdges");svg.style.width="140px";svg.style.height="140px";svg.style.padding="0";svg.style.background="#fff";});
  new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});apply();
}

styleOnce();installFetchCapture();installCustomerActions();installStaffRequests();installAdminReturn();installQRFix();
