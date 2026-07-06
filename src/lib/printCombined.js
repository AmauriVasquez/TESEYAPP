/**
 * Orquestador de impresión: abre una ventana con varios bloques HTML ya renderizados
 * (uno por página) y ESPERA a que las imágenes remotas carguen antes de imprimir.
 * Reemplaza el setTimeout(500) ingenuo por un gate real de carga de imágenes.
 */
import { PRINT_LETTER_WINDOW_STYLES } from './printLetterWindowCss.js';

export async function imprimirDocumentoCombinado({ bloquesHTML, titulo, cssVars }) {
  const w = window.open('', '_blank');
  if (!w) {
    console.error('Popup bloqueado. No se puede imprimir.');
    return false;
  }

  const { primario, secundario, acento } = cssVars || {};
  const cuerpo = (bloquesHTML || [])
    .map((html) => `<div class="doc-bloque">${html}</div>`)
    .join('');

  w.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${titulo || ''}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          ${PRINT_LETTER_WINDOW_STYLES}
          :root {
            --color-primario: ${primario};
            --color-secundario: ${secundario};
            --color-acento: ${acento};
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          [class*="entrega-bloque"], .report-entrega-item, .print-doc-root { break-inside: avoid; }
          .doc-bloque + .doc-bloque { page-break-before: always; }
        </style>
      </head>
      <body>
        <div id="print-area">${cuerpo}</div>
      </body>
    </html>
  `);
  w.document.close();

  // Gate de imágenes: resolvemos con lo que dispare primero (load/error/timeout).
  const imgs = Array.from(w.document.images);
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          // ponytail: 4s fallback so a dead Storage URL never hangs print; raise if slow links truncate.
          const t = setTimeout(resolve, 4000);
          const done = () => { clearTimeout(t); resolve(); };
          img.onload = done;
          img.onerror = done;
        })
    )
  );

  w.focus();
  w.print();
  return true;
}
