import { useState, useEffect } from "react";

const C = {
  bg: "#1a1612",
  bgCard: "#242018",
  bgLight: "#2e2820",
  gold: "#C8913A",
  goldCl: "#E8B96A",
  cream: "#F0E6D3",
  textSub: "#9A8870",
  border: "#3a3228",
};

export default function PantallaPago({
  pedido,
  metodoPago,
  onPagoConfirmado,
  onCambiarMetodo,
}) {
  const [copiado, setCopiado] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  const config = {
    mp_alias: localStorage.getItem("mp_alias") || "",
    mp_cbu: localStorage.getItem("mp_cbu") || "",
    mp_titular: localStorage.getItem("mp_titular") || "",
    mp_qr_url: localStorage.getItem("mp_qr_url") || "",
    transfer_alias: localStorage.getItem("transfer_alias") || "",
    transfer_cbu: localStorage.getItem("transfer_cbu") || "",
    transfer_titular: localStorage.getItem("transfer_titular") || "",
    transfer_banco: localStorage.getItem("transfer_banco") || "",
  };

  const copiar = async (texto, campo) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(campo);
    setTimeout(() => setCopiado(null), 2000);
  };

  const confirmar = async () => {
    if (!onPagoConfirmado) {
      alert("No llegó la función de pago");
      return;
    }

    setConfirmando(true);

    try {
      console.log("CLICK CONFIRMAR");
      await onPagoConfirmado();
      console.log("PAGO OK");
    } catch (error) {
      console.error("ERROR PAGO:", error);
      alert("Error al confirmar pago");
    } finally {
      setConfirmando(false);
    }
  };

  const total = Number(pedido.total || pedido.totalCobrado || 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: C.bgCard,
          border: `2px solid ${C.gold}`,
          borderRadius: "20px",
          width: "100%",
          maxWidth: "420px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.2rem 1.5rem",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                color: C.gold,
                fontFamily: "Georgia, serif",
                fontWeight: "800",
                fontSize: "1.1rem",
              }}
            >
              Cobrar pedido #{pedido.numero || pedido.numeroPedido || ""}
            </div>
            <div style={{ color: C.textSub, fontSize: "12px" }}>
              {pedido.mesa ? `Mesa ${pedido.mesa}` : "Sin mesa"}
            </div>
          </div>
          <div
            style={{
              color: C.gold,
              fontFamily: "Georgia, serif",
              fontWeight: "900",
              fontSize: "1.6rem",
            }}
          >
            ${total.toLocaleString()}
          </div>
        </div>

        {/* Selector de método */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: C.textSub,
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Método de pago
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["EFECTIVO", "QR", "TRANSFERENCIA"].map((m) => (
              <button
                key={m}
                style={{
                  flex: 1,
                  padding: "9px 6px",
                  borderRadius: "10px",
                  border:
                    metodoPago === m
                      ? `1.5px solid ${C.gold}`
                      : `1px solid ${C.border}`,
                  background:
                    metodoPago === m ? `rgba(200,145,58,0.15)` : "transparent",
                  color: metodoPago === m ? C.gold : C.textSub,
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
                onClick={() => onCambiarMetodo(m)}
              >
                {m === "EFECTIVO"
                  ? "Efectivo"
                  : m === "QR"
                    ? "Mercado Pago"
                    : "Transferencia"}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido según método */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.2rem 1.5rem" }}>
          {/* EFECTIVO */}
          {metodoPago === "EFECTIVO" && (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>💵</div>
              <div
                style={{
                  color: C.cream,
                  fontWeight: "700",
                  fontSize: "16px",
                  marginBottom: "8px",
                }}
              >
                Recibir pago en efectivo
              </div>
              <div
                style={{
                  color: C.gold,
                  fontFamily: "Georgia, serif",
                  fontWeight: "900",
                  fontSize: "2.5rem",
                  marginBottom: "8px",
                }}
              >
                ${total.toLocaleString()}
              </div>
              <div style={{ color: C.textSub, fontSize: "13px" }}>
                Una vez recibido el dinero, confirmá el cobro.
              </div>
            </div>
          )}

          {/* QR — MERCADO PAGO */}
          {metodoPago === "QR" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              {config.mp_qr_url ? (
                <div
                  style={{
                    background: "white",
                    borderRadius: "16px",
                    padding: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={config.mp_qr_url}
                    alt="QR Mercado Pago"
                    style={{
                      width: "200px",
                      height: "200px",
                      objectFit: "contain",
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    background: C.bgLight,
                    borderRadius: "16px",
                    padding: "2rem",
                    textAlign: "center",
                    border: `1px dashed ${C.border}`,
                  }}
                >
                  <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>
                    QR
                  </div>
                  <div style={{ color: C.textSub, fontSize: "13px" }}>
                    Configurá la URL del QR en el panel admin → Configuración →
                    Mercado Pago
                  </div>
                </div>
              )}

              <div
                style={{
                  background: C.bgLight,
                  borderRadius: "12px",
                  padding: "14px",
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: C.textSub,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    marginBottom: "10px",
                  }}
                >
                  Datos de Mercado Pago
                </div>
                {[
                  { label: "Alias", valor: config.mp_alias, key: "mp_alias" },
                  {
                    label: "Titular",
                    valor: config.mp_titular,
                    key: "mp_titular",
                  },
                  ...(config.mp_cbu
                    ? [{ label: "CVU", valor: config.mp_cbu, key: "mp_cbu" }]
                    : []),
                  {
                    label: "Monto exacto",
                    valor: `$${total.toLocaleString()}`,
                    key: "monto",
                    highlight: true,
                  },
                ].map((dato) =>
                  dato.valor ? (
                    <div
                      key={dato.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "7px 0",
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "11px", color: C.textSub }}>
                          {dato.label}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: dato.highlight ? "900" : "700",
                            color: dato.highlight ? C.gold : C.cream,
                            fontFamily: dato.highlight
                              ? "Georgia, serif"
                              : "inherit",
                          }}
                        >
                          {dato.valor}
                        </div>
                      </div>
                      {dato.key !== "monto" && (
                        <button
                          style={{
                            background:
                              copiado === dato.key
                                ? "rgba(74,138,74,0.2)"
                                : "rgba(200,145,58,0.1)",
                            border: `1px solid ${copiado === dato.key ? "#4a8a4a" : C.border}`,
                            borderRadius: "8px",
                            padding: "5px 12px",
                            color: copiado === dato.key ? "#90e090" : C.gold,
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                          }}
                          onClick={() => copiar(dato.valor, dato.key)}
                        >
                          {copiado === dato.key ? "Copiado ✓" : "Copiar"}
                        </button>
                      )}
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {/* TRANSFERENCIA */}
          {metodoPago === "TRANSFERENCIA" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div
                style={{
                  background: C.bgLight,
                  borderRadius: "12px",
                  padding: "14px",
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: C.textSub,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    marginBottom: "10px",
                  }}
                >
                  Datos bancarios
                </div>
                {[
                  {
                    label: "Alias",
                    valor: config.transfer_alias,
                    key: "tr_alias",
                  },
                  { label: "CBU", valor: config.transfer_cbu, key: "tr_cbu" },
                  {
                    label: "Titular",
                    valor: config.transfer_titular,
                    key: "tr_titular",
                  },
                  {
                    label: "Banco",
                    valor: config.transfer_banco,
                    key: "tr_banco",
                  },
                  {
                    label: "Monto exacto",
                    valor: `$${total.toLocaleString()}`,
                    key: "monto",
                    highlight: true,
                  },
                ].map((dato) =>
                  dato.valor ? (
                    <div
                      key={dato.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "11px", color: C.textSub }}>
                          {dato.label}
                        </div>
                        <div
                          style={{
                            fontSize: dato.key === "tr_cbu" ? "13px" : "15px",
                            fontWeight: dato.highlight ? "900" : "700",
                            color: dato.highlight ? C.gold : C.cream,
                            fontFamily: dato.highlight
                              ? "Georgia, serif"
                              : "inherit",
                            wordBreak: "break-all",
                          }}
                        >
                          {dato.valor}
                        </div>
                      </div>
                      {dato.key !== "monto" &&
                        dato.key !== "tr_banco" &&
                        dato.key !== "tr_titular" && (
                          <button
                            style={{
                              background:
                                copiado === dato.key
                                  ? "rgba(74,138,74,0.2)"
                                  : "rgba(200,145,58,0.1)",
                              border: `1px solid ${copiado === dato.key ? "#4a8a4a" : C.border}`,
                              borderRadius: "8px",
                              padding: "5px 12px",
                              color: copiado === dato.key ? "#90e090" : C.gold,
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              flexShrink: 0,
                              marginLeft: "8px",
                            }}
                            onClick={() => copiar(dato.valor, dato.key)}
                          >
                            {copiado === dato.key ? "Copiado ✓" : "Copiar"}
                          </button>
                        )}
                    </div>
                  ) : null,
                )}
              </div>

              {!config.transfer_alias && !config.transfer_cbu && (
                <div
                  style={{
                    color: C.textSub,
                    fontSize: "13px",
                    textAlign: "center",
                    padding: "1rem",
                    background: C.bgLight,
                    borderRadius: "10px",
                    border: `1px dashed ${C.border}`,
                  }}
                >
                  Configurá los datos bancarios en el panel admin →
                  Configuración → Transferencia
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — confirmar pago (no se puede cerrar sin confirmar) */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <button
            style={{
              background: "#C8913A",
              color: "#1a0e00",
              border: "none",
              borderRadius: "12px",
              padding: "16px",
              fontWeight: "900",
              fontSize: "16px",
              cursor: "pointer",
              fontFamily: "Georgia, serif",
              opacity: confirmando ? 0.7 : 1,
            }}
            onClick={confirmar}
            disabled={confirmando}
          >
            {confirmando
              ? "Procesando..."
              : `Confirmar pago recibido — $${total.toLocaleString()}`}
          </button>
          <p
            style={{
              textAlign: "center",
              fontSize: "11px",
              color: C.textSub,
              margin: 0,
            }}
          >
            Al confirmar se emite el ticket automáticamente
          </p>
        </div>
      </div>
    </div>
  );
}
