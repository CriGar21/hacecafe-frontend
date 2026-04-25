import { useRef } from "react";

const RAZON_SOCIAL_DEFAULT = {
  nombre: "HaceCafe",
  subtitulo: "Cafetería & Cocina Artesanal",
  direccion: "Tu dirección acá",
  telefono: "",
  cuit: "",
};

export default function Ticket({
  pedido,
  razonSocial = RAZON_SOCIAL_DEFAULT,
  onCerrar,
}) {
  const ticketRef = useRef();
  const rs = { ...RAZON_SOCIAL_DEFAULT, ...razonSocial };

  const imprimir = () => {
    const contenido = ticketRef.current.innerHTML;
    const ventana = window.open("", "_blank", "width=400,height=600");
    ventana.document.write(`
      <html>
        <head>
          <title>Ticket #${pedido.numero}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; background: white; padding: 8px; width: 280px; }
            .centro { text-align: center; }
            .negrita { font-weight: bold; }
            .grande { font-size: 14px; }
            .separador { border-top: 1px dashed #000; margin: 6px 0; }
            .separador-solido { border-top: 1px solid #000; margin: 6px 0; }
            .fila { display: flex; justify-content: space-between; margin: 3px 0; }
            .fila-total { display: flex; justify-content: space-between; margin: 4px 0; font-weight: bold; font-size: 14px; }
            .nota { font-size: 10px; color: #555; font-style: italic; padding-left: 16px; }
            @media print { body { width: auto; } @page { margin: 4mm; } }
          </style>
        </head>
        <body>${contenido}</body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => {
      ventana.print();
      ventana.close();
    }, 300);
  };

  const descargarPDF = () => {
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF({
        unit: "mm",
        format: [80, 200],
        orientation: "portrait",
      });
      doc.setFont("courier", "normal");
      let y = 8;

      const line = (texto, x = 5, bold = false, size = 10) => {
        doc.setFontSize(size);
        doc.setFont("courier", bold ? "bold" : "normal");
        doc.text(texto, x, y);
        y += size * 0.45;
      };
      const separator = (dashed = true) => {
        doc.setLineDashPattern(dashed ? [1, 1] : [], 0);
        doc.line(4, y, 76, y);
        y += 4;
      };
      const center = (texto, bold = false, size = 10) => {
        doc.setFontSize(size);
        doc.setFont("courier", bold ? "bold" : "normal");
        const w = doc.getTextWidth(texto);
        doc.text(texto, (80 - w) / 2, y);
        y += size * 0.45;
      };

      center(rs.nombre, true, 14);
      y += 2;
      center(rs.subtitulo, false, 8);
      if (rs.direccion) {
        y += 1;
        center(rs.direccion, false, 8);
      }
      if (rs.telefono) {
        center(`Tel: ${rs.telefono}`, false, 8);
      }
      if (rs.cuit) {
        center(`CUIT: ${rs.cuit}`, false, 8);
      }
      y += 2;
      separator(false);

      center(`TICKET #${pedido.numero}`, true, 11);
      y += 1;
      center(
        new Date(pedido.creadoEn).toLocaleString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        false,
        8,
      );
      if (pedido.mesa) {
        center(`Mesa: ${pedido.mesa}`, false, 9);
      }
      y += 2;
      separator();

      pedido.items?.forEach((item) => {
        const subtotalStr = `$${Number(item.subtotal).toLocaleString()}`;
        const itemStr = `${item.cantidad}x ${item.producto?.nombre}`;
        const espacios = 38 - itemStr.length - subtotalStr.length;
        line(
          itemStr + " ".repeat(Math.max(1, espacios)) + subtotalStr,
          5,
          false,
          9,
        );
        if (item.notas) {
          line(`  (${item.notas})`, 5, false, 7);
          y += 1;
        }
        y += 1;
      });

      separator();
      const totalStr = `TOTAL: $${Number(pedido.total).toLocaleString()}`;
      const w = doc.getTextWidth(totalStr);
      doc.setFontSize(12);
      doc.setFont("courier", "bold");
      doc.text(totalStr, (80 - w) / 2, y);
      y += 8;
      separator(false);
      center("¡Gracias por su visita!", false, 9);
      center("HaceCafe", false, 8);

      doc.save(`ticket-${pedido.numero}.pdf`);
    });
  };

  const fecha = new Date(pedido.creadoEn).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onCerrar}
    >
      <div
        style={{
          background: "#1e1a14",
          border: "1px solid #3a3228",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "420px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.2rem",
            borderBottom: "1px solid #3a3228",
          }}
        >
          <span
            style={{ color: "#C8913A", fontWeight: "700", fontSize: "15px" }}
          >
            Ticket #{pedido.numero}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              style={{
                background: "#2e2820",
                border: "1px solid #3a3228",
                borderRadius: "8px",
                padding: "7px 14px",
                color: "#F0E6D3",
                fontSize: "13px",
                cursor: "pointer",
                fontWeight: "600",
              }}
              onClick={descargarPDF}
            >
              PDF
            </button>
            <button
              style={{
                background: "#C8913A",
                border: "none",
                borderRadius: "8px",
                padding: "7px 14px",
                color: "#111009",
                fontSize: "13px",
                cursor: "pointer",
                fontWeight: "700",
              }}
              onClick={imprimir}
            >
              Imprimir
            </button>
            <button
              style={{
                background: "#2e2820",
                border: "1px solid #3a3228",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                color: "#9A8870",
                cursor: "pointer",
                fontSize: "15px",
              }}
              onClick={onCerrar}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Preview del ticket */}
        <div
          style={{
            overflowY: "auto",
            padding: "1.5rem",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            ref={ticketRef}
            style={{
              fontFamily: "'Courier New', monospace",
              fontSize: "12px",
              color: "#000",
              background: "white",
              padding: "16px 12px",
              width: "260px",
              borderRadius: "4px",
              lineHeight: 1.5,
            }}
          >
            <div
              className="centro negrita grande"
              style={{
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "16px",
                marginBottom: "4px",
              }}
            >
              {rs.nombre}
            </div>
            <div
              className="centro"
              style={{
                textAlign: "center",
                fontSize: "11px",
                marginBottom: "2px",
              }}
            >
              {rs.subtitulo}
            </div>
            {rs.direccion && (
              <div style={{ textAlign: "center", fontSize: "10px" }}>
                {rs.direccion}
              </div>
            )}
            {rs.telefono && (
              <div style={{ textAlign: "center", fontSize: "10px" }}>
                Tel: {rs.telefono}
              </div>
            )}
            {rs.cuit && (
              <div style={{ textAlign: "center", fontSize: "10px" }}>
                CUIT: {rs.cuit}
              </div>
            )}

            <div style={{ borderTop: "2px solid #000", margin: "8px 0" }} />

            <div
              style={{
                textAlign: "center",
                fontWeight: "bold",
                fontSize: "13px",
              }}
            >
              TICKET #{pedido.numero}
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: "10px",
                marginBottom: "2px",
              }}
            >
              {fecha}
            </div>
            {pedido.mesa && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "11px",
                  marginBottom: "4px",
                }}
              >
                Mesa: {pedido.mesa}
              </div>
            )}
            {pedido.usuario?.nombre && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: "10px",
                  marginBottom: "4px",
                }}
              >
                Atendido por: {pedido.usuario.nombre}
              </div>
            )}

            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            {pedido.items?.map((item) => (
              <div key={item.id} style={{ marginBottom: "4px" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    {item.cantidad}x {item.producto?.nombre}
                  </span>
                  <span style={{ fontWeight: "bold" }}>
                    ${Number(item.subtotal).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: "10px", color: "#555" }}>
                  &nbsp;&nbsp;${Number(item.precioUnit).toLocaleString()} c/u
                </div>
                {item.notas && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#555",
                      fontStyle: "italic",
                    }}
                  >
                    &nbsp;&nbsp;({item.notas})
                  </div>
                )}
              </div>
            ))}

            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            >
              <span>TOTAL</span>
              <span>${Number(pedido.total).toLocaleString()}</span>
            </div>
            {pedido.metodoPago && (
              <div
                style={{
                  textAlign: "right",
                  fontSize: "10px",
                  color: "#555",
                  marginTop: "2px",
                }}
              >
                {pedido.metodoPago}
              </div>
            )}

            <div style={{ borderTop: "2px solid #000", margin: "8px 0" }} />
            <div style={{ textAlign: "center", fontSize: "11px" }}>
              ¡Gracias por su visita!
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: "10px",
                color: "#555",
                marginTop: "2px",
              }}
            >
              HaceCafe
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
