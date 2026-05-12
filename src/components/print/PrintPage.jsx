import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Una hoja Carta: contenido arriba, pie siempre abajo (flex, sin position:absolute).
 */
export function PrintPage({ content, footer, className }) {
  return (
    <div
      className={cn(
        'print-page page box-border flex min-h-[520px] flex-col bg-white text-black',
        className
      )}
    >
      <div className="print-page-content flex min-h-0 flex-1 flex-col">{content}</div>
      {footer}
    </div>
  );
}

/**
 * Pie de documento con leyenda y numeración solo si totalPages &gt; 1.
 */
export function PrintDocumentFooter({ variant = 'TESEY', pageNumber, totalPages, forcePagination = false }) {
  const left =
    variant === 'IIHEMSA'
      ? 'IIHEMSA - Documento generado desde IIHEMSA Peninsular'
      : 'IIHEMSA Peninsular - Sistema de Control Interno';

  const showPages = totalPages > 1 || forcePagination;

  return (
    <footer className="print-doc-print-footer flex shrink-0 justify-between border-t border-gray-200 pt-2 text-xs text-gray-500">
      <span>{left}</span>
      {showPages ? (
        <span className="font-medium text-gray-600">
          {pageNumber} de {totalPages}
        </span>
      ) : null}
    </footer>
  );
}
