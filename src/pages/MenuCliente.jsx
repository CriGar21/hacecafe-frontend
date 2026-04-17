import { useState, useEffect } from "react";
import api from "../services/api";

export default function MenuCliente() {
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [verCarrito, setVerCarrito] = useState(false);
  const [mesa, setMesa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState(null);

  useEffect(() => {
    api.get("/categorias").then((r) => {
      setCategorias(r.data);
      if (r.data.length > 0) setCategoriaActiva(r.data[0].id);
    });
    api.get("/productos").then((r) => setProductos(r.data));
  }, []);

  const productosFiltrados = productos.filter(
    (p) => p.categoriaId === categoriaActiva,
  );

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === producto.id);
      if (existe)
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const quitarDelCarrito = (productoId) => {
    setCarrito((prev) => {
      const item = prev.find((i) => i.id === productoId);
      if (item.cantidad === 1) return prev.filter((i) => i.id !== productoId);
      return prev.map((i) =>
        i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i,
      );
    });
  };

  const totalCarrito = carrito.reduce(
    (acc, i) => acc + Number(i.precio) * i.cantidad,
    0,
  );
  const cantidadTotal = carrito.reduce((acc, i) => acc + i.cantidad, 0);

  const confirmarPedido = async () => {
    if (carrito.length === 0) return;
    setEnviando(true);
    try {
      const { data } = await fetch("http://localhost:3001/pedidos/publico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa,
          items: carrito.map((i) => ({
            productoId: i.id,
            cantidad: i.cantidad,
          })),
        }),
      }).then((r) => r.json());

      setPedidoConfirmado(data);
      setCarrito([]);
      setVerCarrito(false);
    } catch (error) {
      alert("Error al enviar el pedido. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // Pantalla de pedido confirmado
  if (pedidoConfirmado) {
    return (
      <div style={styles.confirmado}>
        <div style={styles.confirmadoCard}>
          <div style={styles.checkIcon}>✓</div>
          <h2 style={styles.confirmadoTitulo}>¡Pedido enviado!</h2>
          <p style={styles.confirmadoNum}>Pedido #{pedidoConfirmado.numero}</p>
          {pedidoConfirmado.mesa && (
            <p style={styles.confirmadoMesa}>Mesa {pedidoConfirmado.mesa}</p>
          )}
          <div style={styles.confirmadoItems}>
            {pedidoConfirmado.items.map((item) => (
              <div key={item.id} style={styles.confirmadoItem}>
                <span>
                  {item.cantidad}x {item.producto.nombre}
                </span>
                <span>${Number(item.subtotal).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={styles.confirmadoTotal}>
            <span>Total</span>
            <span>${Number(pedidoConfirmado.total).toLocaleString()}</span>
          </div>
          <button
            style={styles.btnNuevoPedido}
            onClick={() => setPedidoConfirmado(null)}
          >
            Hacer otro pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.titulo}>HaceCafe</h1>
        <p style={styles.subtitulo}>Elegí lo que querés</p>
      </div>

      {/* Tabs de categorías */}
      <div style={styles.tabs}>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoriaActiva(cat.id)}
            style={{
              ...styles.tab,
              ...(categoriaActiva === cat.id ? styles.tabActivo : {}),
            }}
          >
            {cat.icono} {cat.nombre}
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      <div style={styles.grid}>
        {productosFiltrados.map((producto) => {
          const enCarrito = carrito.find((i) => i.id === producto.id);
          return (
            <div key={producto.id} style={styles.card}>
              <div style={styles.cardImagen}>
                {producto.imagenUrl ? (
                  <img
                    src={producto.imagenUrl}
                    alt={producto.nombre}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: "2.5rem" }}>
                    {producto.categoria?.icono}
                  </span>
                )}
              </div>
              <div style={styles.cardInfo}>
                <h3 style={styles.cardNombre}>{producto.nombre}</h3>
                {producto.descripcion && (
                  <p style={styles.cardDesc}>{producto.descripcion}</p>
                )}
                <div style={styles.cardFooter}>
                  <span style={styles.precio}>
                    ${Number(producto.precio).toLocaleString()}
                  </span>
                  {enCarrito ? (
                    <div style={styles.contador}>
                      <button
                        style={styles.btnContador}
                        onClick={() => quitarDelCarrito(producto.id)}
                      >
                        −
                      </button>
                      <span style={styles.cantidadContador}>
                        {enCarrito.cantidad}
                      </span>
                      <button
                        style={styles.btnContador}
                        onClick={() => agregarAlCarrito(producto)}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => agregarAlCarrito(producto)}
                      style={styles.btnAgregar}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Carrito flotante */}
      {carrito.length > 0 && !verCarrito && (
        <div style={styles.carrito} onClick={() => setVerCarrito(true)}>
          <div style={styles.carritoInfo}>
            <span style={styles.carritoItems}>
              {cantidadTotal} {cantidadTotal === 1 ? "item" : "items"}
            </span>
            <span style={styles.carritoTotal}>
              ${totalCarrito.toLocaleString()}
            </span>
          </div>
          <button style={styles.btnPedido}>Ver pedido</button>
        </div>
      )}

      {/* Panel del carrito */}
      {verCarrito && (
        <div style={styles.overlay}>
          <div style={styles.carritoPanel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitulo}>Tu pedido</h2>
              <button
                style={styles.btnCerrar}
                onClick={() => setVerCarrito(false)}
              >
                ✕
              </button>
            </div>

            <div style={styles.panelItems}>
              {carrito.map((item) => (
                <div key={item.id} style={styles.panelItem}>
                  <div style={styles.panelItemInfo}>
                    <span style={styles.panelItemNombre}>{item.nombre}</span>
                    <span style={styles.panelItemPrecio}>
                      ${Number(item.precio).toLocaleString()} c/u
                    </span>
                  </div>
                  <div style={styles.contador}>
                    <button
                      style={styles.btnContador}
                      onClick={() => quitarDelCarrito(item.id)}
                    >
                      −
                    </button>
                    <span style={styles.cantidadContador}>{item.cantidad}</span>
                    <button
                      style={styles.btnContador}
                      onClick={() => agregarAlCarrito(item)}
                    >
                      +
                    </button>
                  </div>
                  <span style={styles.panelItemSubtotal}>
                    ${(Number(item.precio) * item.cantidad).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div style={styles.panelMesa}>
              <label style={styles.mesaLabel}>Número de mesa (opcional)</label>
              <input
                type="text"
                placeholder="Ej: 5"
                value={mesa}
                onChange={(e) => setMesa(e.target.value)}
                style={styles.mesaInput}
              />
            </div>

            <div style={styles.panelFooter}>
              <div style={styles.panelTotal}>
                <span>Total</span>
                <span style={styles.panelTotalNum}>
                  ${totalCarrito.toLocaleString()}
                </span>
              </div>
              <button
                style={{ ...styles.btnConfirmar, opacity: enviando ? 0.7 : 1 }}
                onClick={confirmarPedido}
                disabled={enviando}
              >
                {enviando ? "Enviando..." : "Confirmar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f8f8f8",
    paddingBottom: "100px",
  },
  header: { background: "#1a1a1a", padding: "1.5rem", textAlign: "center" },
  titulo: { color: "white", fontSize: "1.8rem", fontWeight: "700", margin: 0 },
  subtitulo: { color: "#aaa", fontSize: "13px", margin: "4px 0 0" },
  tabs: {
    display: "flex",
    gap: "8px",
    padding: "1rem",
    overflowX: "auto",
    background: "white",
    borderBottom: "1px solid #eee",
  },
  tab: {
    padding: "8px 16px",
    borderRadius: "20px",
    border: "1.5px solid #e0e0e0",
    background: "white",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: "14px",
    fontWeight: "500",
  },
  tabActivo: {
    background: "#1a1a1a",
    color: "white",
    border: "1.5px solid #1a1a1a",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "12px",
    padding: "1rem",
  },
  card: {
    background: "white",
    borderRadius: "14px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  cardImagen: {
    height: "120px",
    background: "#f0f0f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { padding: "12px" },
  cardNombre: {
    fontSize: "14px",
    fontWeight: "600",
    margin: "0 0 4px",
    color: "#1a1a1a",
  },
  cardDesc: {
    fontSize: "12px",
    color: "#888",
    margin: "0 0 8px",
    lineHeight: "1.4",
  },
  cardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  precio: { fontSize: "15px", fontWeight: "700", color: "#1a1a1a" },
  btnAgregar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#1a1a1a",
    color: "white",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  contador: { display: "flex", alignItems: "center", gap: "8px" },
  btnContador: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#f0f0f0",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
  },
  cantidadContador: {
    fontSize: "15px",
    fontWeight: "700",
    minWidth: "20px",
    textAlign: "center",
  },
  carrito: {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1a1a1a",
    color: "white",
    borderRadius: "50px",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    gap: "20px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    width: "calc(100% - 40px)",
    maxWidth: "400px",
    cursor: "pointer",
  },
  carritoInfo: { display: "flex", flexDirection: "column" },
  carritoItems: { fontSize: "12px", color: "#aaa" },
  carritoTotal: { fontSize: "17px", fontWeight: "700" },
  btnPedido: {
    background: "white",
    color: "#1a1a1a",
    border: "none",
    borderRadius: "30px",
    padding: "10px 20px",
    fontWeight: "700",
    cursor: "pointer",
    marginLeft: "auto",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "flex-end",
    zIndex: 100,
  },
  carritoPanel: {
    background: "white",
    borderRadius: "20px 20px 0 0",
    padding: "1.5rem",
    width: "100%",
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitulo: { fontSize: "1.2rem", fontWeight: "700", margin: 0 },
  btnCerrar: {
    background: "#f0f0f0",
    border: "none",
    borderRadius: "50%",
    width: "32px",
    height: "32px",
    cursor: "pointer",
    fontSize: "16px",
  },
  panelItems: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
    flex: 1,
  },
  panelItem: { display: "flex", alignItems: "center", gap: "12px" },
  panelItemInfo: { flex: 1, display: "flex", flexDirection: "column" },
  panelItemNombre: { fontSize: "14px", fontWeight: "600" },
  panelItemPrecio: { fontSize: "12px", color: "#888" },
  panelItemSubtotal: {
    fontSize: "15px",
    fontWeight: "700",
    minWidth: "70px",
    textAlign: "right",
  },
  panelMesa: { display: "flex", flexDirection: "column", gap: "6px" },
  mesaLabel: { fontSize: "13px", color: "#666", fontWeight: "500" },
  mesaInput: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1.5px solid #e0e0e0",
    fontSize: "15px",
  },
  panelFooter: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    borderTop: "1px solid #eee",
    paddingTop: "1rem",
  },
  panelTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "16px",
    fontWeight: "500",
  },
  panelTotalNum: { fontSize: "1.4rem", fontWeight: "800" },
  btnConfirmar: {
    background: "#1a1a1a",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "16px",
    fontWeight: "700",
    fontSize: "16px",
    cursor: "pointer",
  },
  confirmado: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8f8f8",
    padding: "1rem",
  },
  confirmadoCard: {
    background: "white",
    borderRadius: "20px",
    padding: "2rem",
    width: "100%",
    maxWidth: "380px",
    textAlign: "center",
  },
  checkIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "#d1e7dd",
    color: "#0a3622",
    fontSize: "2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 1rem",
    fontWeight: "700",
  },
  confirmadoTitulo: {
    fontSize: "1.5rem",
    fontWeight: "700",
    margin: "0 0 4px",
  },
  confirmadoNum: { fontSize: "1.1rem", color: "#666", margin: "0 0 4px" },
  confirmadoMesa: { fontSize: "14px", color: "#888", margin: "0 0 1.5rem" },
  confirmadoItems: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "1rem",
  },
  confirmadoItem: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    padding: "6px 0",
    borderBottom: "1px solid #f0f0f0",
  },
  confirmadoTotal: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: "700",
    fontSize: "16px",
    marginBottom: "1.5rem",
  },
  btnNuevoPedido: {
    background: "#1a1a1a",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "14px 28px",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
    width: "100%",
  },
};
