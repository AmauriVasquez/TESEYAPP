/**
 * Estilos para ventana popup de impresión: formato Carta (Letter), márgenes @page mínimos.
 * El documento debe ir dentro de <div id="print-area">...</div>
 * Soporta varias .print-page (pie fijo abajo por hoja).
 */
export const PRINT_LETTER_WINDOW_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

@page {
  size: letter;
  margin: 5mm;
}

html, body {
  font-family: 'Inter', sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  margin: 0;
  padding: 16px;
  background: #fff;
}

#print-area {
  position: relative;
  width: 100%;
  max-width: 216mm;
  margin: 0 auto;
}

#print-area, #print-area * {
  visibility: visible;
}

/* Vista previa en pantalla (ventana popup): altura mínima tipo hoja */
#print-area .print-page,
#print-area .page {
  min-height: 520px;
  max-width: 216mm;
  margin-left: auto;
  margin-right: auto;
  padding: 12px 16px;
  margin-bottom: 24px;
  border: 1px solid #e5e7eb;
}

@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }

  body * {
    visibility: hidden;
  }

  #print-area,
  #print-area * {
    visibility: visible;
  }

  #print-area {
    position: relative;
    left: auto;
    top: auto;
    width: 100%;
    max-width: none;
    margin: 0;
  }

  /* Medición DOM del pedido: no debe imprimirse ni afectar :last-child del flujo real */
  #print-area .pm-pedido-measure-root {
    display: none !important;
  }

  #print-area .print-page,
  #print-area .page {
    width: 100%;
    box-sizing: border-box;
    min-height: 269mm;
    max-width: 206mm;
    margin: 0 auto;
    padding: 10mm;
    margin-bottom: 0;
    border: none;
    page-break-after: always;
    break-after: page;
  }

  #print-area .print-page:last-child,
  #print-area .page:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  #print-area .print-page-content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Cotización u otros documentos de una sola raíz (sin .print-page) */
  #print-area .print-doc-root {
    padding: 4mm 5mm !important;
    min-height: 0 !important;
    max-width: 216mm !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }

  #print-area .print-doc-header {
    margin-bottom: 8px !important;
    padding-bottom: 8px !important;
  }

  #print-area .print-doc-header > div:first-child {
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    min-height: 80px !important;
  }

  #print-area .print-doc-section {
    margin-bottom: 8px !important;
    margin-top: 0 !important;
  }

  #print-area .print-doc-table-wrap {
    margin-top: 8px !important;
  }

  #print-area .print-doc-lower {
    margin-top: 8px !important;
    padding-top: 8px !important;
    gap: 8px !important;
  }

  #print-area .print-doc-print-footer {
    margin-top: auto !important;
    padding-top: 8px !important;
    font-size: 10px !important;
    color: #6b7280 !important;
  }

  #print-area .print-doc-footer {
    margin-top: 8px !important;
    padding-top: 6px !important;
    font-size: 10px !important;
    color: #6b7280 !important;
  }

  #print-area .shadow,
  #print-area .shadow-sm,
  #print-area .shadow-md,
  #print-area .shadow-xl {
    box-shadow: none !important;
  }

  #print-area .rounded-lg,
  #print-area .rounded-md,
  #print-area .rounded {
    border-radius: 0 !important;
  }

  #print-area thead {
    display: table-header-group;
  }

  #print-area tr {
    page-break-inside: avoid;
  }

  /* Pedido de materiales: filas asignadas por página en React; no forzar anti-corte global */
  #print-area .pm-pedido-print-table tr {
    page-break-inside: auto !important;
    break-inside: auto !important;
  }

  #print-area .print-doc-logo {
    max-height: 80px !important;
    width: 176px !important;
    height: auto !important;
    object-fit: contain !important;
    object-position: center !important;
  }

  #print-area .print-doc-cell-tight {
    padding-top: 4px !important;
    padding-bottom: 4px !important;
  }

  #print-area .print-doc-th-tight {
    padding-top: 4px !important;
    padding-bottom: 4px !important;
  }

  #print-area .print-doc-totals {
    padding: 8px !important;
    border-radius: 0 !important;
  }

  #print-area .p-6 { padding: 10px !important; }
  #print-area .p-10 { padding: 12px !important; }
  #print-area .p-8 { padding: 10px !important; }
  #print-area .p-4 { padding: 6px !important; }
  #print-area .mb-6 { margin-bottom: 8px !important; }
  #print-area .mt-6 { margin-top: 8px !important; }
  #print-area .mt-4 { margin-top: 6px !important; }
  #print-area .pt-4 { padding-top: 8px !important; }
  #print-area .pb-4 { padding-bottom: 8px !important; }
  #print-area .gap-6 { gap: 8px !important; }
}
`;
