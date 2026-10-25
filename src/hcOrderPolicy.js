const KEY = "hc_cliente_pedido";
function order(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}}
function apply(){const p=order();const actions=document.querySelector(".hc-flow-actions");if(!actions||!p)return;if(!["ESPERANDO_APROBACION","PENDIENTE"].includes(p.estado))actions.querySelector("button.primary")?.remove();if(!["ESPERANDO_APROBACION","PENDIENTE","EN_PREPARACION"].includes(p.estado))actions.querySelector("button.danger")?.remove();if(!actions.children.length)actions.remove()}
new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
