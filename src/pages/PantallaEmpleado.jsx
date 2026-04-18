import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const TABS = ['Cargar pedido', 'Mis pedidos', 'Cobrar']

const COLORES_ESTADO = {
  PENDIENTE:      { bg: '#fff3cd', color: '#856404', label: 'Pendiente' },
  EN_PREPARACION: { bg: '#cfe2ff', color: '#0a58ca', label: 'En preparación' },
  LISTO:          { bg: '#d1e7dd', color: '#0a3622', label: 'Listo' },
  ENTREGADO:      { bg: '#f0f0f0', color: '#444',    label: 'Entregado' },
  COBRADO:        { bg: '#e8f5e9', color: '#2e7d32', label: 'Cobrado' },
  CANCELADO:      { bg: '#f8d7da', color: '#842029', label: 'Cancelado' },
}

export default function PantallaEmpleado() {
  const { usuario, logout } = useAuth()
  const [tab, setTab] = useState(0)

  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState([])
  const [mesa, setMesa] = useState('')
  const [notas, setNotas] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmado, setConfirmado] = useState(null)

  const [misPedidos, setMisPedidos] = useState([])

  // Estado cobrar — unificado mesa + número
  const [busquedaCobro, setBusquedaCobro] = useState('')
  const [tipoBusqueda, setTipoBusqueda] = useState('mesa') // 'mesa' | 'numero'
  const [pedidosCobro, setPedidosCobro] = useState([])
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [cobrando, setCobrando] = useState(false)
  const [cobrado, setCobrado] = useState(null)

  const cargarPedidos = useCallback(() => {
    api.get('/pedidos').then(r => {
      const activos = r.data.filter(p => !['COBRADO', 'CANCELADO'].includes(p.estado))
      setMisPedidos(activos)
    })
  }, [])

  useEffect(() => {
    api.get('/categorias').then(r => {
      setCategorias(r.data)
      if (r.data.length > 0) setCategoriaActiva(r.data[0].id)
    })
    api.get('/productos').then(r => setProductos(r.data))
    cargarPedidos()

    const socket = io('http://localhost:3001', {
      transports: ['websocket'],
      reconnection: true
    })

    socket.on('nuevo_pedido', (pedido) => {
      setMisPedidos(prev => {
        const existe = prev.find(p => p.id === pedido.id)
        if (existe) return prev
        return [pedido, ...prev]
      })
    })

    socket.on('pedido_actualizado', (pedidoActualizado) => {
      setMisPedidos(prev =>
        prev.map(p => p.id === pedidoActualizado.id ? pedidoActualizado : p)
      )
    })

    socket.on('mesa_cobrada', ({ pedidoIds }) => {
      setMisPedidos(prev => prev.filter(p => !pedidoIds.includes(p.id)))
    })

    return () => socket.disconnect()
  }, [cargarPedidos])

  const productosFiltrados = productos.filter(p => {
    if (busqueda) return p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    return p.categoriaId === categoriaActiva
  })

  const agregarAlCarrito = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === producto.id)
      if (existe) return prev.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const quitarDelCarrito = (productoId) => {
    setCarrito(prev => {
      const item = prev.find(i => i.id === productoId)
      if (item.cantidad === 1) return prev.filter(i => i.id !== productoId)
      return prev.map(i => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i)
    })
  }

  const totalCarrito = carrito.reduce((acc, i) => acc + Number(i.precio) * i.cantidad, 0)

  const confirmarPedido = async () => {
    if (carrito.length === 0) return
    setEnviando(true)
    try {
      const { data } = await api.post('/pedidos', {
        mesa, notas,
        items: carrito.map(i => ({ productoId: i.id, cantidad: i.cantidad }))
      })
      setConfirmado(data)
      setCarrito([])
      setMesa('')
      setNotas('')
    } catch {
      alert('Error al enviar pedido')
    } finally {
      setEnviando(false)
    }
  }

  // Ir directo a cobrar desde un pedido
  const irACobrarPedido = (pedido) => {
    setTipoBusqueda('numero')
    setBusquedaCobro(String(pedido.numero))
    setPedidosCobro([pedido])
    setCobrado(null)
    setTab(2)
  }

  const buscarParaCobrar = async () => {
    if (!busquedaCobro.trim()) return
    try {
      const url = tipoBusqueda === 'mesa'
        ? `/pedidos/mesa/${busquedaCobro}`
        : `/pedidos/numero/${busquedaCobro}`
      const { data } = await api.get(url)
      setPedidosCobro(Array.isArray(data) ? data : [data])
      setCobrado(null)
    } catch {
      alert('No se encontraron pedidos')
      setPedidosCobro([])
    }
  }

  const totalCobro = pedidosCobro.reduce((acc, p) => acc + Number(p.total), 0)

  const cobrarPedidos = async () => {
    if (pedidosCobro.length === 0) return
    setCobrando(true)
    try {
      const body = tipoBusqueda === 'mesa'
        ? { mesa: busquedaCobro, metodoPago }
        : { numeroPedido: busquedaCobro, metodoPago }
      const { data } = await api.post('/pedidos/cobrar', body)
      setCobrado(data)
      setPedidosCobro([])
      setBusquedaCobro('')
    } catch {
      alert('Error al cobrar')
    } finally {
      setCobrando(false)
    }
  }

  const listos = misPedidos.filter(p => ['LISTO', 'ENTREGADO'].includes(p.estado)).length

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.headerNombre}>HaceCafe</div>
          <div style={styles.headerUsuario}>{usuario?.nombre} — {usuario?.rol}</div>
        </div>
        <button style={styles.btnLogout} onClick={logout}>Salir</button>
      </div>

      <div style={styles.tabs}>
        {TABS.map((t, i) => (
          <button
            key={i}
            style={{ ...styles.tab, ...(tab === i ? styles.tabActivo : {}) }}
            onClick={() => { setTab(i); setConfirmado(null); setCobrado(null) }}
          >
            {t}
            {i === 1 && listos > 0 && (
              <span style={styles.tabBadge}>{listos}</span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 0 — Cargar pedido */}
      {tab === 0 && (
        <div style={styles.content}>
          {confirmado ? (
            <div style={styles.confirmadoBox}>
              <div style={styles.checkIcon}>✓</div>
              <h2 style={styles.confirmadoTitulo}>Pedido #{confirmado.numero} enviado</h2>
              {confirmado.mesa && <p style={styles.confirmadoSub}>Mesa {confirmado.mesa}</p>}
              <div style={styles.confirmadoItems}>
                {confirmado.items.map(item => (
                  <div key={item.id} style={styles.confirmadoItem}>
                    <span>{item.cantidad}x {item.producto.nombre}</span>
                    <span>${Number(item.subtotal).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={styles.confirmadoTotal}>
                <span>Total</span>
                <span>${Number(confirmado.total).toLocaleString()}</span>
              </div>
              <div style={styles.confirmadoBtns}>
                <button style={styles.btnPrimario} onClick={() => setConfirmado(null)}>
                  Nuevo pedido
                </button>
                <button style={styles.btnSecundario} onClick={() => irACobrarPedido(confirmado)}>
                  Cobrar este pedido
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.layoutDos}>
              <div style={styles.panelMenu}>
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); setCategoriaActiva(null) }}
                  style={styles.buscador}
                />
                {!busqueda && (
                  <div style={styles.categorias}>
                    {categorias.map(cat => (
                      <button
                        key={cat.id}
                        style={{ ...styles.catBtn, ...(categoriaActiva === cat.id ? styles.catBtnActivo : {}) }}
                        onClick={() => setCategoriaActiva(cat.id)}
                      >
                        {cat.icono} {cat.nombre}
                      </button>
                    ))}
                  </div>
                )}
                <div style={styles.listaProductos}>
                  {productosFiltrados.map(producto => {
                    const enCarrito = carrito.find(i => i.id === producto.id)
                    return (
                      <div key={producto.id} style={styles.productoRow}>
                        <div style={styles.productoInfo}>
                          <span style={styles.productoNombre}>{producto.nombre}</span>
                          <span style={styles.productoPrecio}>${Number(producto.precio).toLocaleString()}</span>
                        </div>
                        <div style={styles.contador}>
                          {enCarrito && <button style={styles.btnContador} onClick={() => quitarDelCarrito(producto.id)}>−</button>}
                          {enCarrito && <span style={styles.cantidadContador}>{enCarrito.cantidad}</span>}
                          <button style={styles.btnContadorPrimario} onClick={() => agregarAlCarrito(producto)}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={styles.panelCarrito}>
                <h3 style={styles.carritoTitulo}>Pedido actual</h3>
                <input
                  type="text"
                  placeholder="Mesa (opcional)"
                  value={mesa}
                  onChange={e => setMesa(e.target.value)}
                  style={styles.inputMesa}
                />
                {carrito.length === 0 ? (
                  <p style={styles.carritoVacio}>Agregá productos desde el menú</p>
                ) : (
                  <>
                    <div style={styles.carritoItems}>
                      {carrito.map(item => (
                        <div key={item.id} style={styles.carritoItem}>
                          <div style={styles.carritoItemInfo}>
                            <span style={styles.carritoItemNombre}>{item.nombre}</span>
                            <span style={styles.carritoItemSub}>${Number(item.precio).toLocaleString()} c/u</span>
                          </div>
                          <div style={styles.contador}>
                            <button style={styles.btnContador} onClick={() => quitarDelCarrito(item.id)}>−</button>
                            <span style={styles.cantidadContador}>{item.cantidad}</span>
                            <button style={styles.btnContadorPrimario} onClick={() => agregarAlCarrito(item)}>+</button>
                          </div>
                          <span style={styles.carritoItemTotal}>
                            ${(Number(item.precio) * item.cantidad).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                    <textarea
                      placeholder="Notas del pedido (opcional)"
                      value={notas}
                      onChange={e => setNotas(e.target.value)}
                      style={styles.notasInput}
                      rows={2}
                    />
                    <div style={styles.carritoFooter}>
                      <div style={styles.carritoTotal}>
                        <span>Total</span>
                        <span style={styles.carritoTotalNum}>${totalCarrito.toLocaleString()}</span>
                      </div>
                      <button
                        style={{ ...styles.btnPrimario, opacity: enviando ? 0.7 : 1 }}
                        onClick={confirmarPedido}
                        disabled={enviando}
                      >
                        {enviando ? 'Enviando...' : 'Enviar a cocina'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1 — Mis pedidos */}
      {tab === 1 && (
        <div style={styles.content}>
          {misPedidos.length === 0 ? (
            <p style={styles.vacio}>No hay pedidos activos</p>
          ) : (
            <div style={styles.gridPedidos}>
              {misPedidos.map(pedido => {
                const estilo = COLORES_ESTADO[pedido.estado]
                return (
                  <div key={pedido.id} style={{ ...styles.pedidoCard, background: estilo.bg }}>
                    <div style={styles.pedidoHeader}>
                      <span style={styles.pedidoNumero}>#{pedido.numero}</span>
                      {pedido.mesa && <span style={styles.pedidoMesa}>Mesa {pedido.mesa}</span>}
                      <span style={{ ...styles.pedidoEstado, color: estilo.color }}>{estilo.label}</span>
                    </div>
                    <div style={styles.pedidoItems}>
                      {pedido.items.map(item => (
                        <div key={item.id} style={styles.pedidoItem}>
                          <span>{item.cantidad}x {item.producto.nombre}</span>
                          <span>${Number(item.subtotal).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div style={styles.pedidoFooter}>
                      <span style={styles.pedidoTotal}>
                        ${Number(pedido.total).toLocaleString()}
                      </span>
                      <button
                        style={styles.btnCobrarDirecto}
                        onClick={() => irACobrarPedido(pedido)}
                      >
                        Cobrar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2 — Cobrar */}
      {tab === 2 && (
        <div style={styles.content}>
          {cobrado ? (
            <div style={styles.confirmadoBox}>
              <div style={{ ...styles.checkIcon, background: '#d1e7dd', color: '#0a3622' }}>$</div>
              <h2 style={styles.confirmadoTitulo}>Cobrado correctamente</h2>
              {cobrado.mesa && <p style={styles.confirmadoSub}>Mesa {cobrado.mesa}</p>}
              {cobrado.numeroPedido && <p style={styles.confirmadoSub}>Pedido #{cobrado.numeroPedido}</p>}
              <p style={styles.confirmadoSub}>{cobrado.metodoPago}</p>
              <div style={styles.confirmadoTotal}>
                <span>Total cobrado</span>
                <span>${Number(cobrado.totalCobrado).toLocaleString()}</span>
              </div>
              <button style={styles.btnPrimario} onClick={() => { setCobrado(null); setBusquedaCobro('') }}>
                Cobrar otro
              </button>
            </div>
          ) : (
            <div style={styles.cobrarContainer}>

              {/* Selector mesa / número */}
              <div style={styles.tipoSelector}>
                <button
                  style={{ ...styles.tipoBtn, ...(tipoBusqueda === 'mesa' ? styles.tipoBtnActivo : {}) }}
                  onClick={() => { setTipoBusqueda('mesa'); setBusquedaCobro(''); setPedidosCobro([]) }}
                >
                  Por mesa
                </button>
                <button
                  style={{ ...styles.tipoBtn, ...(tipoBusqueda === 'numero' ? styles.tipoBtnActivo : {}) }}
                  onClick={() => { setTipoBusqueda('numero'); setBusquedaCobro(''); setPedidosCobro([]) }}
                >
                  Por N° pedido
                </button>
              </div>

              <div style={styles.cobrarBusqueda}>
                <input
                  type="text"
                  placeholder={tipoBusqueda === 'mesa' ? 'Número de mesa' : 'Número de pedido'}
                  value={busquedaCobro}
                  onChange={e => setBusquedaCobro(e.target.value)}
                  style={styles.inputMesa}
                  onKeyDown={e => e.key === 'Enter' && buscarParaCobrar()}
                />
                <button style={styles.btnSecundario} onClick={buscarParaCobrar}>
                  Buscar
                </button>
              </div>

              {pedidosCobro.length > 0 && (
                <>
                  <div style={styles.resumenMesa}>
                    <h4 style={styles.resumenTitulo}>
                      {tipoBusqueda === 'mesa' ? `Mesa ${busquedaCobro}` : `Pedido #${busquedaCobro}`}
                    </h4>
                    {pedidosCobro.map(pedido => (
                      <div key={pedido.id} style={styles.resumenPedido}>
                        <span style={styles.resumenNumero}>
                          Pedido #{pedido.numero} {pedido.mesa ? `— Mesa ${pedido.mesa}` : ''}
                        </span>
                        {pedido.items.map(item => (
                          <div key={item.id} style={styles.resumenItem}>
                            <span>{item.cantidad}x {item.producto.nombre}</span>
                            <span>${Number(item.subtotal).toLocaleString()}</span>
                          </div>
                        ))}
                        <div style={{ ...styles.resumenItem, fontWeight: '600', borderTop: '1px solid #eee', paddingTop: '6px', marginTop: '4px' }}>
                          <span>Subtotal pedido</span>
                          <span>${Number(pedido.total).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                    <div style={styles.resumenTotal}>
                      <span>Total a cobrar</span>
                      <span style={styles.resumenTotalNum}>${totalCobro.toLocaleString()}</span>
                    </div>
                  </div>

                  <div style={styles.metodoPagoContainer}>
                    <h4 style={styles.metodoPagoTitulo}>Método de pago</h4>
                    <div style={styles.metodoPagoBtns}>
                      {['EFECTIVO', 'TARJETA', 'QR'].map(metodo => (
                        <button
                          key={metodo}
                          style={{ ...styles.metodoPagoBtn, ...(metodoPago === metodo ? styles.metodoPagoBtnActivo : {}) }}
                          onClick={() => setMetodoPago(metodo)}
                        >
                          {metodo === 'EFECTIVO' ? 'Efectivo' : metodo === 'TARJETA' ? 'Tarjeta' : 'QR / Transfer'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    style={{ ...styles.btnPrimario, fontSize: '1.1rem', padding: '16px', opacity: cobrando ? 0.7 : 1 }}
                    onClick={cobrarPedidos}
                    disabled={cobrando}
                  >
                    {cobrando ? 'Procesando...' : `Cobrar $${totalCobro.toLocaleString()}`}
                  </button>
                </>
              )}

              {pedidosCobro.length === 0 && busquedaCobro && (
                <p style={styles.vacio}>No se encontraron pedidos activos</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', background: '#f8f8f8', display: 'flex', flexDirection: 'column' },
  header: { background: '#1a1a1a', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerNombre: { color: 'white', fontWeight: '700', fontSize: '1.1rem' },
  headerUsuario: { color: '#aaa', fontSize: '12px', marginTop: '2px' },
  btnLogout: { background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' },
  tabs: { display: 'flex', background: 'white', borderBottom: '1px solid #eee' },
  tab: { flex: 1, padding: '14px 8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  tabActivo: { color: '#1a1a1a', borderBottom: '2px solid #1a1a1a' },
  tabBadge: { background: '#e53e3e', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: '700' },
  content: { flex: 1, padding: '1rem', overflowY: 'auto' },
  layoutDos: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1rem' },
  panelMenu: { display: 'flex', flexDirection: 'column', gap: '10px' },
  buscador: { padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e0e0e0', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  categorias: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  catBtn: { padding: '6px 14px', borderRadius: '20px', border: '1.5px solid #e0e0e0', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  catBtnActivo: { background: '#1a1a1a', color: 'white', border: '1.5px solid #1a1a1a' },
  listaProductos: { display: 'flex', flexDirection: 'column', gap: '6px' },
  productoRow: { background: 'white', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  productoInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
  productoNombre: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a' },
  productoPrecio: { fontSize: '13px', color: '#666' },
  contador: { display: 'flex', alignItems: 'center', gap: '8px' },
  btnContador: { width: '30px', height: '30px', borderRadius: '50%', background: '#f0f0f0', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnContadorPrimario: { width: '30px', height: '30px', borderRadius: '50%', background: '#1a1a1a', color: 'white', border: 'none', fontSize: '18px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cantidadContador: { fontSize: '15px', fontWeight: '700', minWidth: '20px', textAlign: 'center' },
  panelCarrito: { background: 'white', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '10px', height: 'fit-content', position: 'sticky', top: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  carritoTitulo: { fontSize: '16px', fontWeight: '700', margin: 0 },
  inputMesa: { padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e0e0e0', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  carritoVacio: { color: '#aaa', fontSize: '13px', textAlign: 'center', padding: '1rem 0' },
  carritoItems: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' },
  carritoItem: { display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0' },
  carritoItemInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  carritoItemNombre: { fontSize: '13px', fontWeight: '600' },
  carritoItemSub: { fontSize: '11px', color: '#888' },
  carritoItemTotal: { fontSize: '13px', fontWeight: '700', minWidth: '60px', textAlign: 'right' },
  notasInput: { padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e0e0e0', fontSize: '13px', resize: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  carritoFooter: { display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #eee', paddingTop: '10px' },
  carritoTotal: { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '500' },
  carritoTotalNum: { fontSize: '1.3rem', fontWeight: '800' },
  btnPrimario: { background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '10px', padding: '13px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', width: '100%' },
  btnSecundario: { background: 'white', color: '#1a1a1a', border: '1.5px solid #1a1a1a', borderRadius: '10px', padding: '10px 20px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  gridPedidos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' },
  pedidoCard: { borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' },
  pedidoHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  pedidoNumero: { fontSize: '1.3rem', fontWeight: '800', color: '#1a1a1a' },
  pedidoMesa: { background: 'rgba(0,0,0,0.08)', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' },
  pedidoEstado: { marginLeft: 'auto', fontSize: '12px', fontWeight: '700' },
  pedidoItems: { display: 'flex', flexDirection: 'column', gap: '4px' },
  pedidoItem: { display: 'flex', justifyContent: 'space-between', fontSize: '13px' },
  pedidoFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '8px', marginTop: '4px' },
  pedidoTotal: { fontSize: '15px', fontWeight: '700', color: '#1a1a1a' },
  btnCobrarDirecto: { background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  vacio: { color: '#aaa', textAlign: 'center', padding: '3rem', fontSize: '14px' },
  confirmadoBox: { maxWidth: '400px', margin: '2rem auto', background: 'white', borderRadius: '20px', padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  checkIcon: { width: '64px', height: '64px', borderRadius: '50%', background: '#d1e7dd', color: '#0a3622', fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontWeight: '700' },
  confirmadoTitulo: { fontSize: '1.3rem', fontWeight: '700', margin: 0 },
  confirmadoSub: { color: '#666', fontSize: '14px', margin: 0 },
  confirmadoItems: { display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' },
  confirmadoItem: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid #f0f0f0' },
  confirmadoTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px', paddingTop: '4px' },
  confirmadoBtns: { display: 'flex', flexDirection: 'column', gap: '8px' },
  cobrarContainer: { maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' },
  tipoSelector: { display: 'flex', gap: '8px' },
  tipoBtn: { flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e0e0e0', background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  tipoBtnActivo: { background: '#1a1a1a', color: 'white', border: '1.5px solid #1a1a1a' },
  cobrarBusqueda: { display: 'flex', gap: '10px' },
  resumenMesa: { background: 'white', borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  resumenTitulo: { fontWeight: '700', margin: 0, fontSize: '15px' },
  resumenPedido: { display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0' },
  resumenNumero: { fontSize: '12px', fontWeight: '600', color: '#666' },
  resumenItem: { display: 'flex', justifyContent: 'space-between', fontSize: '13px' },
  resumenTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '16px', paddingTop: '4px' },
  resumenTotalNum: { fontSize: '1.3rem', fontWeight: '800' },
  metodoPagoContainer: { display: 'flex', flexDirection: 'column', gap: '8px' },
  metodoPagoTitulo: { fontWeight: '700', margin: 0, fontSize: '14px' },
  metodoPagoBtns: { display: 'flex', gap: '8px' },
  metodoPagoBtn: { flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e0e0e0', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  metodoPagoBtnActivo: { background: '#1a1a1a', color: 'white', border: '1.5px solid #1a1a1a' },
}