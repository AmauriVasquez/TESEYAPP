import React, {
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
  forwardRef,
} from 'react';
import { cn } from '@/lib/utils';
import { formatDateForPrint } from '@/lib/dateUtils';
import { PrintPage, PrintDocumentFooter } from '@/components/print/PrintPage';
import { getBrandVisuals } from '@/lib/brandLogos';
import { descripcionImpresionPedidoItem, unidadImpresionPedidoItem } from '@/lib/pedidoMaterialesItemHelpers';

/** Partidas en 1ª hoja (fallback hasta medir el DOM). */
const ROWS_FIRST_PAGE = 7;
/** Partidas en hojas siguientes (fallback). */
const ROWS_NEXT_PAGE = 14;

const MIN_ROW_BUDGET_PX = 28;

/**
 * Folio oficial del pedido: prioriza valor persistido (ej. PED-0001).
 * Si no hay folio, deriva PED-XXXX desde id numérico.
 */
export function resolvePedidoMaterialFolio(raw) {
  const f = raw?.folio;
  if (f != null && String(f).trim() !== '') return String(f).trim();
  const id = raw?.id;
  if (id != null && id !== '' && Number.isFinite(Number(id))) {
    return `PED-${String(id).padStart(4, '0')}`;
  }
  return 'POR ASIGNAR';
}

function normalizeItems(data) {
  const list = data?.items ?? data?.pedidos_materiales_items ?? [];
  return Array.isArray(list) ? list : [];
}

function observacionesGenerales(data) {
  const t = data?.observaciones ?? data?.observaciones_generales;
  if (t != null && String(t).trim() !== '') return String(t).trim();
  return null;
}

function chunkItemsForPrint(items, firstSize, restSize) {
  if (!items.length) return [[]];
  const pages = [];
  let i = 0;
  let size = firstSize;
  while (i < items.length) {
    pages.push(items.slice(i, i + size));
    i += size;
    size = restSize;
  }
  return pages;
}

/**
 * Reparte partidas según alturas medidas de cada fila (tbody).
 * @param {object[]} items
 * @param {number[]} rowHeightsPx
 * @param {number} rowBudgetFirst — alto disponible solo para filas en página 1
 * @param {number} rowBudgetNext — alto disponible en páginas siguientes
 */
function splitItemsForPrintPages(items, rowHeightsPx, rowBudgetFirst, rowBudgetNext) {
  if (!items.length) return [[]];

  const safeFirst = Number.isFinite(rowBudgetFirst) ? rowBudgetFirst : 0;
  const safeNext = Number.isFinite(rowBudgetNext) ? rowBudgetNext : 0;

  const pages = [];
  let i = 0;
  let first = true;

  while (i < items.length) {
    const capRaw = first ? safeFirst : safeNext;
    if (capRaw <= 0) {
      return chunkItemsForPrint(items, ROWS_FIRST_PAGE, ROWS_NEXT_PAGE);
    }

    const cap = Math.max(MIN_ROW_BUDGET_PX, capRaw);
    const chunk = [];
    let used = 0;

    while (i < items.length) {
      const h = Math.max(1, rowHeightsPx[i] ?? MIN_ROW_BUDGET_PX);
      if (h > cap) {
        if (chunk.length) break;
        chunk.push(items[i]);
        i++;
        break;
      }
      if (used + h > cap) break;
      chunk.push(items[i]);
      used += h;
      i++;
    }

    if (chunk.length > 0) pages.push(chunk);
    first = false;
  }

  const nonEmpty = pages.filter((c) => Array.isArray(c) && c.length > 0);
  if (nonEmpty.length) return nonEmpty;
  return chunkItemsForPrint(items, ROWS_FIRST_PAGE, ROWS_NEXT_PAGE);
}

function densityTableClasses(printDensity) {
  const compact = printDensity === 'compact';
  return {
    th: compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
    td: compact ? 'px-1.5 py-1' : 'px-2 py-2',
  };
}

function PedidoPrintThead({ isIIH, thClass, theadRef }) {
  return (
    <thead ref={theadRef}>
      <tr className={cn('text-white', isIIH ? 'bg-blue-900' : 'bg-gray-900')}>
        <th
          className={cn(
            'print-doc-th-tight w-12 rounded-tl-md text-center font-bold',
            thClass
          )}
        >
          #
        </th>
        <th className={cn('print-doc-th-tight text-left font-bold', thClass)}>Descripción del Material</th>
        <th className={cn('print-doc-th-tight w-24 text-center font-bold', thClass)}>Unidad</th>
        <th className={cn('print-doc-th-tight w-24 rounded-tr-md text-center font-bold', thClass)}>
          Cantidad
        </th>
      </tr>
    </thead>
  );
}

const PedidoPrintTableRow = forwardRef(function PedidoPrintTableRow(
  { item, displayIndex, isIIH, tipoPedido, tdClass },
  ref
) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-gray-200',
        !isIIH && 'hover:bg-orange-50',
        isIIH && 'hover:bg-gray-50'
      )}
    >
      <td className={cn('print-doc-cell-tight text-center font-bold text-gray-400', tdClass)}>
        {displayIndex}
      </td>
      <td className={cn('print-doc-cell-tight min-w-0', tdClass)}>
        <p className="font-bold text-gray-900 break-words [overflow-wrap:anywhere]">
          {descripcionImpresionPedidoItem(item, tipoPedido)}
        </p>
        {item.observaciones ? (
          <p className="mt-0.5 text-[10px] italic text-gray-500 break-words [overflow-wrap:anywhere]">
            Nota: {item.observaciones}
          </p>
        ) : null}
      </td>
      <td className={cn('print-doc-cell-tight text-center uppercase text-gray-500', tdClass)}>
        {unidadImpresionPedidoItem(item)}
      </td>
      <td className={cn('print-doc-cell-tight text-center', tdClass)}>
        <span
          className={cn(
            'inline-block rounded px-2 py-1 font-bold',
            isIIH
              ? 'bg-blue-50 text-blue-700'
              : 'border border-orange-100 bg-orange-50 text-orange-700'
          )}
        >
          {item.cantidad}
        </span>
      </td>
    </tr>
  );
});

function PedidoPrintHeader({ isIIH, fechaStr, compact, logoSrc, logoAlt, brandKey }) {
  if (compact) {
    return (
      <header
        className={cn(
          'print-doc-header flex items-center justify-between gap-3 border-b-2 pb-2 mb-2',
          isIIH ? 'border-blue-900' : 'border-orange-600'
        )}
      >
        <div className="min-w-0 flex-1 text-[10px] leading-tight">
          <span className="font-bold text-gray-900">
            {brandKey === 'IIHEMSA'
              ? 'IIHEMSA — Pedido de materiales'
              : brandKey === 'TESEY'
                ? 'TESEY — Pedido de materiales'
                : 'IIHEMSA Peninsular — Pedido de materiales'}
          </span>
          <span className="text-gray-500"> · Emisión: {fechaStr}</span>
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        'print-doc-header flex justify-between items-start pb-3 border-b-4 mb-3',
        isIIH ? 'border-blue-900' : 'border-orange-600'
      )}
    >
      <div className={cn('w-48', isIIH && 'pt-1 flex items-start')}>
        <img
          alt={logoAlt}
          className="print-doc-logo h-16 w-auto object-contain"
          src={logoSrc}
        />
      </div>
      <div className="text-right flex-1 pl-8">
        {isIIH ? (
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            INGENIERÍA E INSTALACIONES HIDRONEUMÁTICAS
            <br />
            ELÉCTRICAS Y MONTAJES.
          </h1>
        ) : (
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            Tecnomaquila y Servicios de Yucatán
          </h1>
        )}
        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
          <p
            className={cn(
              'uppercase',
              isIIH ? 'font-semibold text-blue-900' : 'font-bold text-orange-600'
            )}
          >
            Pedido de Materiales
          </p>
          <p>Fecha de Emisión: {fechaStr}</p>
        </div>
      </div>
    </header>
  );
}

function PedidoPrintDataSection({ isIIH, folio, proyectoCuenta, solicitante, obs }) {
  return (
    <div
      className={cn(
        'print-doc-section rounded-lg p-2.5 mb-4 border bg-white',
        isIIH ? 'border-gray-300' : 'border-gray-200 shadow-sm'
      )}
    >
      <div
        className={cn(
          'flex justify-between items-center mb-2 pb-1',
          isIIH ? 'border-b border-gray-200' : 'border-b border-orange-100'
        )}
      >
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Folio</span>
        <span className="text-lg font-bold text-red-600">{folio}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px]">
        <div className="flex flex-col">
          <span className="text-gray-500 font-semibold text-[9px]">Proyecto / Cuenta:</span>
          <span className="font-bold text-gray-900">{proyectoCuenta}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-gray-500 font-semibold text-[9px]">Solicitado por:</span>
          <span className="font-medium text-gray-900 uppercase">{solicitante}</span>
        </div>
        <div
          className={cn(
            'col-span-2 mt-1 pt-1',
            isIIH ? 'border-t border-gray-200' : 'border-t border-gray-100'
          )}
        >
          <span className="text-gray-500 font-semibold block mb-0.5 text-[9px]">
            Observaciones Generales:
          </span>
          <p
            className={cn(
              'text-gray-700 italic p-1.5 leading-tight rounded break-words [overflow-wrap:anywhere]',
              isIIH ? 'bg-white border-0' : 'bg-gray-50 border border-gray-100'
            )}
          >
            {obs || 'Sin observaciones adicionales.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function PedidoPrintContinuation({ folio, isIIH }) {
  return (
    <div
      className={cn(
        'mb-3 border-b-2 pb-2 text-[10px]',
        isIIH ? 'border-blue-200 text-blue-900' : 'border-orange-100 text-gray-700'
      )}
    >
      <span className="font-bold">{folio}</span>
      <span className="text-gray-500"> — continuación</span>
    </div>
  );
}

function PedidoPrintTable({ isIIH, pageItems, rowOffset, tipoPedido, printDensity }) {
  const { th, td } = densityTableClasses(printDensity);
  return (
    <div className="print-doc-table-wrap pm-pedido-print-table flex min-h-0 flex-1 flex-col">
      <table className="w-full border-collapse text-xs table-fixed">
        <PedidoPrintThead isIIH={isIIH} thClass={th} />
        <tbody className="text-gray-700">
          {pageItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="border-b bg-gray-50 py-8 text-center italic text-gray-400">
                No hay partidas agregadas a este pedido.
              </td>
            </tr>
          ) : (
            pageItems.map((item, idx) => (
              <PedidoPrintTableRow
                key={item.id ?? item.uniqueId ?? `${rowOffset}-${idx}`}
                item={item}
                displayIndex={rowOffset + idx + 1}
                isIIH={isIIH}
                tipoPedido={tipoPedido}
                tdClass={td}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Documento de impresión de pedido de materiales (sin modal, sin botones).
 * Paginación por medición DOM (altura real por fila).
 *
 * @param {'normal'|'compact'} [printDensity]
 */
const PedidoMaterialPrint = ({
  data,
  pedidoData,
  variant = 'TESEY',
  marca: marcaProp,
  className,
  printDensity = 'normal',
}) => {
  const src = data ?? pedidoData ?? {};
  const tipoPedido = (src.tipo_pedido ?? 'material') === 'activo' ? 'activo' : 'material';
  const items = useMemo(() => normalizeItems(src), [src]);
  const folio = useMemo(() => resolvePedidoMaterialFolio(src), [src]);
  const fechaStr = formatDateForPrint(src.fecha);
  const obs = observacionesGenerales(src);
  /**
   * Prioridad: valor del <select> (marcaProp). `variant` solo distingue IIHEMSA vs resto
   * y NO diferencia Peninsular vs TESEY; nunca usar `variant || marcaProp` (variant siempre truthy).
   */
  const marca =
    marcaProp != null && String(marcaProp).trim() !== '' ? marcaProp : variant;

  console.log('SELECT variant:', variant);
  console.log('PROP marcaProp:', marcaProp);
  console.log('FINAL marca:', marca);

  const normalized = String(marca ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (!['TESEY', 'IIHEMSA', 'IIHEMSA_PENINSULAR'].includes(normalized)) {
    console.warn('Marca inválida detectada:', marca);
  }

  const brandVisuals = getBrandVisuals(marca);

  const isIIH =
    brandVisuals.key === 'IIHEMSA' || brandVisuals.key === 'IIHEMSA_PENINSULAR';

  const proyectoCuenta = src.proyecto?.folio
    ? `${src.proyecto.folio} - ${src.proyecto.descripcion ?? ''}`
    : src.cuenta || 'Sin Asignar';
  const solicitante = src.solicitante?.nombre_completo || 'Usuario del Sistema';

  const footerVariant = isIIH ? 'IIHEMSA' : 'TESEY';
  const { th: thDensity, td: tdDensity } = densityTableClasses(printDensity);

  const measureRootRef = useRef(null);
  const shellContentRef = useRef(null);
  const firstHeadRef = useRef(null);
  const firstTableWrapRef = useRef(null);
  const firstTheadRef = useRef(null);
  const nextHeadRef = useRef(null);
  const nextTableWrapRef = useRef(null);
  const nextTheadRef = useRef(null);
  const rowRefs = useRef([]);

  const [measuredPages, setMeasuredPages] = useState(null);

  const fallbackPages = useMemo(
    () => chunkItemsForPrint(items, ROWS_FIRST_PAGE, ROWS_NEXT_PAGE),
    [items]
  );

  const recomputePages = useCallback(() => {
    if (!items.length) {
      setMeasuredPages([[]]);
      return;
    }

    const shellContent = shellContentRef.current;
    const firstHead = firstHeadRef.current;
    const firstWrap = firstTableWrapRef.current;
    const firstThead = firstTheadRef.current;
    const nextHead = nextHeadRef.current;
    const nextWrap = nextTableWrapRef.current;
    const nextThead = nextTheadRef.current;

    if (
      !shellContent ||
      !firstHead ||
      !firstWrap ||
      !firstThead ||
      !nextHead ||
      !nextWrap ||
      !nextThead
    ) {
      return;
    }

    const contentBudget = shellContent.clientHeight;
    if (!Number.isFinite(contentBudget) || contentBudget <= 0) return;
    if (contentBudget < MIN_ROW_BUDGET_PX * 2) return;

    const headRect = firstHead.getBoundingClientRect();
    const wrapRect = firstWrap.getBoundingClientRect();
    const theadRect = firstThead.getBoundingClientRect();
    const gapFirst = Math.max(0, wrapRect.top - headRect.bottom);
    const overheadFirst = firstHead.offsetHeight + gapFirst + theadRect.height;

    const nextHeadRect = nextHead.getBoundingClientRect();
    const nextWrapRect = nextWrap.getBoundingClientRect();
    const nextTheadRect = nextThead.getBoundingClientRect();
    const gapNext = Math.max(0, nextWrapRect.top - nextHeadRect.bottom);
    const overheadNext = nextHead.offsetHeight + gapNext + nextTheadRect.height;

    const rowHeights = items.map((_, idx) => {
      const el = rowRefs.current[idx];
      if (!el) return MIN_ROW_BUDGET_PX;
      const h = el.getBoundingClientRect().height;
      return h > 0 ? h : MIN_ROW_BUDGET_PX;
    });

    const rowBudgetFirst = contentBudget - overheadFirst;
    const rowBudgetNext = contentBudget - overheadNext;

    if (rowBudgetFirst < MIN_ROW_BUDGET_PX || rowBudgetNext < MIN_ROW_BUDGET_PX) {
      setMeasuredPages(chunkItemsForPrint(items, ROWS_FIRST_PAGE, ROWS_NEXT_PAGE));
      return;
    }

    const pages = splitItemsForPrintPages(items, rowHeights, rowBudgetFirst, rowBudgetNext);
    setMeasuredPages(pages);
  }, [items, printDensity, isIIH, folio, obs, proyectoCuenta, solicitante, fechaStr, marca, tipoPedido]);

  useLayoutEffect(() => {
    recomputePages();
    const root = measureRootRef.current;
    if (!root) return undefined;

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => recomputePages());
      ro.observe(root);
    }

    const onResize = () => recomputePages();
    window.addEventListener('resize', onResize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [recomputePages]);

  const pagesSource = measuredPages ?? fallbackPages;

  const cleanPages = useMemo(() => {
    if (!items.length) return [[]];
    const filtered = pagesSource.filter((p) => Array.isArray(p) && p.length > 0);
    if (import.meta.env.DEV) {
      console.log(
        'PedidoMaterialPrint páginas (partidas por hoja):',
        filtered.map((p) => p.length)
      );
    }
    if (filtered.length > 0) return filtered;
    return chunkItemsForPrint(items, ROWS_FIRST_PAGE, ROWS_NEXT_PAGE);
  }, [items, pagesSource]);

  const totalPages = cleanPages.length;

  const rowOffsetByPage = useMemo(() => {
    let acc = 0;
    return cleanPages.map((chunk) => {
      const start = acc;
      acc += chunk.length;
      return start;
    });
  }, [cleanPages]);

  rowRefs.current = [];

  return (
    <div className={cn('relative flex flex-col gap-8', className)}>
      <style>{`
        @media print {
          .pm-pedido-measure-root {
            display: none !important;
          }
        }
      `}</style>
      {/* Medición primero: el último hijo del contenedor debe ser la última hoja para que :last-child quite el salto extra */}
      <div
        ref={measureRootRef}
        className="pm-pedido-measure-root"
        aria-hidden
        style={{
          position: 'absolute',
          left: '-12000px',
          top: 0,
          width: '206mm',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div
          className="bg-white text-black"
          style={{
            width: '206mm',
            minHeight: '269mm',
            boxSizing: 'border-box',
            padding: '10mm',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            ref={shellContentRef}
            className="flex min-h-0 flex-1 flex-col"
            style={{ flex: '1 1 auto', minHeight: 0 }}
          >
            <div style={{ flex: '1 1 auto', minHeight: '1px' }} />
          </div>
          <PrintDocumentFooter
            variant={footerVariant}
            pageNumber={1}
            totalPages={99}
            forcePagination
          />
        </div>

        <div className="bg-white text-black" style={{ width: '206mm' }}>
          <div ref={firstHeadRef}>
            <PedidoPrintHeader
              isIIH={isIIH}
              fechaStr={fechaStr}
              compact={false}
              logoSrc={brandVisuals.logoSrc}
              logoAlt={brandVisuals.logoAlt}
              brandKey={brandVisuals.key}
            />
            <PedidoPrintDataSection
              isIIH={isIIH}
              folio={folio}
              proyectoCuenta={proyectoCuenta}
              solicitante={solicitante}
              obs={obs}
            />
          </div>
          <div ref={firstTableWrapRef} className="print-doc-table-wrap flex min-h-0 flex-1 flex-col">
            <table className="w-full border-collapse text-xs table-fixed">
              <PedidoPrintThead isIIH={isIIH} thClass={thDensity} theadRef={firstTheadRef} />
              <tbody className="text-gray-700">
                {items.map((item, idx) => (
                  <PedidoPrintTableRow
                    key={item.id ?? item.uniqueId ?? `m-${idx}`}
                    ref={(el) => {
                      if (el) rowRefs.current[idx] = el;
                    }}
                    item={item}
                    displayIndex={idx + 1}
                    isIIH={isIIH}
                    tipoPedido={tipoPedido}
                    tdClass={tdDensity}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white text-black" style={{ width: '206mm' }}>
          <div ref={nextHeadRef}>
            <PedidoPrintHeader
              isIIH={isIIH}
              fechaStr={fechaStr}
              compact
              logoSrc={brandVisuals.logoSrc}
              logoAlt={brandVisuals.logoAlt}
              brandKey={brandVisuals.key}
            />
            <PedidoPrintContinuation folio={folio} isIIH={isIIH} />
          </div>
          <div ref={nextTableWrapRef} className="print-doc-table-wrap flex min-h-0 flex-1 flex-col">
            <table className="w-full border-collapse text-xs table-fixed">
              <PedidoPrintThead isIIH={isIIH} thClass={thDensity} theadRef={nextTheadRef} />
            </table>
          </div>
        </div>
      </div>

      {cleanPages.map((pageItems, pageIndex) => {
        const footer = (
          <PrintDocumentFooter
            variant={footerVariant}
            pageNumber={pageIndex + 1}
            totalPages={totalPages}
          />
        );

        const content = (
          <>
            <PedidoPrintHeader
              isIIH={isIIH}
              fechaStr={fechaStr}
              compact={pageIndex > 0}
              logoSrc={brandVisuals.logoSrc}
              logoAlt={brandVisuals.logoAlt}
              brandKey={brandVisuals.key}
            />
            {pageIndex === 0 ? (
              <PedidoPrintDataSection
                isIIH={isIIH}
                folio={folio}
                proyectoCuenta={proyectoCuenta}
                solicitante={solicitante}
                obs={obs}
              />
            ) : (
              <PedidoPrintContinuation folio={folio} isIIH={isIIH} />
            )}
            <PedidoPrintTable
              isIIH={isIIH}
              pageItems={pageItems}
              rowOffset={rowOffsetByPage[pageIndex]}
              tipoPedido={tipoPedido}
              printDensity={printDensity}
            />
          </>
        );

        return (
          <PrintPage
            key={`${pageIndex}-${pageItems.length}-${rowOffsetByPage[pageIndex]}`}
            className="min-h-[269mm] max-w-[206mm] w-full"
            content={content}
            footer={footer}
          />
        );
      })}
    </div>
  );
};

export default PedidoMaterialPrint;
