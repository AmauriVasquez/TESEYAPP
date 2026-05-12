import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker, DayButton } from 'react-day-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { mergeDayPickerClassNames } from '@/components/ui/day-picker-classnames';

const ISO = 'yyyy-MM-dd';
const DRAG_THRESHOLD_PX = 5;
const CLICK_DEBOUNCE_MS = 150;

function parseIsoDate(str) {
  if (!str || !String(str).trim()) return undefined;
  const d = startOfDay(parse(String(str).trim(), ISO, new Date()));
  return isValid(d) ? d : undefined;
}

function isPreviewBetween(date, fromD, hoveredDate) {
  if (!fromD || !hoveredDate) return false;
  const lo = isBefore(hoveredDate, fromD) ? hoveredDate : fromD;
  const hi = isAfter(hoveredDate, fromD) ? hoveredDate : fromD;
  return isAfter(date, lo) && isBefore(date, hi);
}

function formatRangeLabel(fromD, toD) {
  const fmt = (d) =>
    format(d, 'dd MMM yyyy', { locale: es })
      .replace(/\./g, '')
      .toLowerCase();
  if (!fromD && !toD) return null;
  if (fromD && toD && isSameDay(fromD, toD)) return fmt(fromD);
  if (fromD && toD) return `${fmt(fromD)} — ${fmt(toD)}`;
  if (fromD) return fmt(fromD);
  return null;
}

const PRESET_DEFS = [
  {
    id: 'today',
    label: 'Hoy',
    range: () => {
      const t = startOfDay(new Date());
      return { from: t, to: t };
    },
  },
  {
    id: 'yesterday',
    label: 'Ayer',
    range: () => {
      const t = startOfDay(subDays(new Date(), 1));
      return { from: t, to: t };
    },
  },
  {
    id: 'last7',
    label: 'Últimos 7 días',
    range: () => {
      const to = startOfDay(new Date());
      const from = startOfDay(subDays(to, 6));
      return { from, to };
    },
  },
  {
    id: 'last30',
    label: 'Últimos 30 días',
    range: () => {
      const to = startOfDay(new Date());
      const from = startOfDay(subDays(to, 29));
      return { from, to };
    },
  },
  {
    id: 'thisMonth',
    label: 'Este mes',
    range: () => {
      const now = new Date();
      return { from: startOfDay(startOfMonth(now)), to: startOfDay(now) };
    },
  },
  {
    id: 'lastMonth',
    label: 'Mes pasado',
    range: () => {
      const ref = subMonths(new Date(), 1);
      return {
        from: startOfDay(startOfMonth(ref)),
        to: startOfDay(endOfMonth(ref)),
      };
    },
  },
];

const transitionCell = 'transition-all duration-150 ease-in-out';

/**
 * @param {object} props
 * @param {{ from: string, to: string }} props.value
 * @param {function} props.onChange
 * @param {import('react-day-picker').Matcher} [props.disabledDays] Días no seleccionables (Matcher de react-day-picker)
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Seleccionar rango de fechas',
  className,
  id,
  disabled: triggerDisabled,
  disabledDays,
  'aria-label': ariaLabel = 'Seleccionar rango de fechas',
}) {
  const [open, setOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [isPointerDragging, setIsPointerDragging] = useState(false);
  const [dragPointerFine, setDragPointerFine] = useState(true);
  const [noTouchApi, setNoTouchApi] = useState(true);

  const pendingPointerRef = useRef(null);
  const dragActiveRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef(null);
  const dragPreviewRef = useRef(null);
  const suppressClickRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  const removeGlobalListenersRef = useRef(null);

  const fromD = parseIsoDate(value?.from);
  const toD = parseIsoDate(value?.to);

  const defaultMonth = useMemo(() => fromD ?? toD ?? new Date(), [value?.from, value?.to]);

  const displayText = useMemo(() => formatRangeLabel(fromD, toD), [fromD, toD]);

  /** Siempre from <= to cuando hay dos fechas; solo-from usa to: ''. */
  const emitRange = useCallback((from, to) => {
    if (from == null && to == null) {
      onChange({ from: '', to: '' });
      return;
    }
    if (from == null) return;
    let a = startOfDay(from);
    if (to == null) {
      onChange({ from: format(a, ISO), to: '' });
      return;
    }
    let b = startOfDay(to);
    if (isBefore(b, a)) {
      const t = a;
      a = b;
      b = t;
    }
    onChange({ from: format(a, ISO), to: format(b, ISO) });
  }, [onChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    setNoTouchApi(!('ontouchstart' in window));
    const mq = window.matchMedia('(pointer: fine)');
    const apply = () => setDragPointerFine(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const dragSelectionEnabled = dragPointerFine && noTouchApi;

  const setDragPreviewSync = useCallback((next) => {
    if (next && next.from && next.to) {
      let a = startOfDay(next.from);
      let b = startOfDay(next.to);
      if (isBefore(b, a)) {
        const t = a;
        a = b;
        b = t;
      }
      const normalized = { from: a, to: b };
      dragPreviewRef.current = normalized;
      setDragPreview(normalized);
      return;
    }
    dragPreviewRef.current = next;
    setDragPreview(next);
  }, []);

  const displayFrom = dragPreview?.from ?? fromD;
  const displayTo = dragPreview?.to ?? toD;

  const clearGlobalListeners = useCallback(() => {
    removeGlobalListenersRef.current?.();
    removeGlobalListenersRef.current = null;
  }, []);

  const resetDragUi = useCallback(() => {
    clearGlobalListeners();
    pendingPointerRef.current = null;
    dragActiveRef.current = false;
    isDraggingRef.current = false;
    setIsPointerDragging(false);
    dragMovedRef.current = false;
    dragStartRef.current = null;
    dragPreviewRef.current = null;
    setDragPreview(null);
  }, [clearGlobalListeners]);

  const finalizePointerSession = useCallback(
    (shouldCommit) => {
      const active = dragActiveRef.current;
      const preview = dragPreviewRef.current;

      if (shouldCommit && active && preview?.from && preview?.to) {
        emitRange(preview.from, preview.to);
        setOpen(false);
        setHoveredDate(null);
        suppressClickRef.current = true;
      }

      resetDragUi();
    },
    [emitRange, resetDragUi]
  );

  const attachGlobalPointerListeners = useCallback(
    (originX, originY, anchorDate) => {
      clearGlobalListeners();

      const onMove = (e) => {
        const p = pendingPointerRef.current;
        if (!p || dragActiveRef.current) return;
        const dx = e.clientX - p.clientX;
        const dy = e.clientY - p.clientY;
        if (dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          dragActiveRef.current = true;
          isDraggingRef.current = true;
          setIsPointerDragging(true);
          const anchor = startOfDay(p.anchorDate);
          dragStartRef.current = anchor;
          dragMovedRef.current = false;
          setDragPreviewSync({ from: anchor, to: anchor });
        }
      };

      const onUp = () => {
        clearGlobalListeners();
        const active = dragActiveRef.current;
        const preview = dragPreviewRef.current;
        const shouldCommit = active && preview?.from && preview?.to;
        finalizePointerSession(Boolean(shouldCommit));
      };

      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);

      removeGlobalListenersRef.current = () => {
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
      };
    },
    [clearGlobalListeners, finalizePointerSession, setDragPreviewSync]
  );

  useEffect(() => {
    if (!open) {
      clearGlobalListeners();
      resetDragUi();
    }
  }, [open, clearGlobalListeners, resetDragUi]);

  useEffect(
    () => () => {
      clearGlobalListeners();
    },
    [clearGlobalListeners]
  );

  const handleDayPointerDown = useCallback(
    (date, clientX, clientY) => {
      if (!dragSelectionEnabled) return;
      const a = parseIsoDate(value?.from);
      const b = parseIsoDate(value?.to);
      if (a && !b) return;

      pendingPointerRef.current = {
        clientX,
        clientY,
        anchorDate: startOfDay(date),
      };
      dragActiveRef.current = false;
      attachGlobalPointerListeners(clientX, clientY, date);
    },
    [dragSelectionEnabled, value?.from, value?.to, attachGlobalPointerListeners]
  );

  const handleDayMouseEnter = useCallback(
    (date) => {
      const day = startOfDay(date);
      if (dragSelectionEnabled && dragActiveRef.current && dragStartRef.current) {
        dragMovedRef.current = true;
        const start = dragStartRef.current;
        let from;
        let to;
        if (isBefore(day, start)) {
          from = day;
          to = start;
        } else {
          from = start;
          to = day;
        }
        setDragPreviewSync({ from, to });
        return;
      }
      if (!pendingPointerRef.current) {
        setHoveredDate(day);
      }
    },
    [dragSelectionEnabled, setDragPreviewSync]
  );

  const handleCalendarMouseLeave = useCallback(() => {
    if (pendingPointerRef.current || dragActiveRef.current) {
      clearGlobalListeners();
      resetDragUi();
    } else {
      setHoveredDate(null);
    }
  }, [clearGlobalListeners, resetDragUi]);

  const handleDaySelect = useCallback(
    (date) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (pendingPointerRef.current || dragActiveRef.current) {
        return;
      }

      const now = Date.now();
      if (now - lastClickTimeRef.current < CLICK_DEBOUNCE_MS) {
        return;
      }
      lastClickTimeRef.current = now;

      const day = startOfDay(date);
      const a = parseIsoDate(value?.from);
      const b = parseIsoDate(value?.to);

      if (a && b) {
        emitRange(day, null);
        return;
      }
      if (!a) {
        emitRange(day, null);
        return;
      }
      let start = a;
      let end = day;
      if (isBefore(day, a)) {
        start = day;
        end = a;
      }
      emitRange(start, end);
      resetDragUi();
      setOpen(false);
      setHoveredDate(null);
    },
    [value?.from, value?.to, emitRange, resetDragUi]
  );

  const handleDayKeyDown = useCallback(
    (date, _modifiers, e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDaySelect(date);
      }
    },
    [handleDaySelect]
  );

  const onOpenChange = useCallback(
    (next) => {
      setOpen(next);
      if (!next) {
        resetDragUi();
        setHoveredDate(null);
      }
    },
    [resetDragUi]
  );

  const applyPreset = useCallback(
    (getRange) => {
      const { from, to } = getRange();
      emitRange(from, to);
      resetDragUi();
      setOpen(false);
      setHoveredDate(null);
    },
    [emitRange, resetDragUi]
  );

  const handleFooterHoy = useCallback(() => {
    applyPreset(PRESET_DEFS[0].range);
  }, [applyPreset]);

  const handleLimpiar = useCallback(() => {
    emitRange(null, null);
    resetDragUi();
    setHoveredDate(null);
  }, [emitRange, resetDragUi]);

  const modifiers = useMemo(() => {
    const f = displayFrom;
    const t = displayTo;
    return {
      range_single: (d) => !!f && !!t && isSameDay(f, t) && isSameDay(d, f),
      range_start: (d) => {
        if (!f) return false;
        if (!t) return isSameDay(d, f);
        if (isSameDay(f, t)) return false;
        const lo = isBefore(f, t) ? f : t;
        return isSameDay(d, lo);
      },
      range_end: (d) => {
        if (!f || !t || isSameDay(f, t)) return false;
        const hi = isAfter(f, t) ? f : t;
        return isSameDay(d, hi);
      },
      range_middle: (d) => {
        if (!f || !t || isSameDay(f, t)) return false;
        const lo = isBefore(f, t) ? f : t;
        const hi = isAfter(f, t) ? f : t;
        return isAfter(d, lo) && isBefore(d, hi);
      },
      preview_range: (d) => {
        if (dragPreview) return false;
        if (!fromD || toD || !hoveredDate) return false;
        if (isSameDay(d, fromD) || isSameDay(d, hoveredDate)) return false;
        return isPreviewBetween(d, fromD, hoveredDate);
      },
    };
  }, [displayFrom, displayTo, dragPreview, fromD, toD, hoveredDate]);

  const modifiersClassNames = useMemo(
    () => ({
      range_single: cn(
        'bg-primary text-primary-foreground [&_.rdp-day_button]:bg-transparent [&_.rdp-day_button]:text-primary-foreground',
        transitionCell
      ),
      range_start: cn(
        'bg-primary text-primary-foreground [&_.rdp-day_button]:bg-transparent [&_.rdp-day_button]:text-primary-foreground',
        transitionCell
      ),
      range_end: cn(
        'bg-primary text-primary-foreground [&_.rdp-day_button]:bg-transparent [&_.rdp-day_button]:text-primary-foreground',
        transitionCell
      ),
      range_middle: cn(
        'bg-primary/15 text-primary [&_.rdp-day_button]:bg-transparent [&_.rdp-day_button]:text-primary',
        transitionCell
      ),
      preview_range: cn('bg-primary/10 [&_.rdp-day_button]:bg-transparent', transitionCell),
    }),
    []
  );

  const pickerComponents = useMemo(() => {
    if (!dragSelectionEnabled) return undefined;
    return {
      DayButton: (props) => (
        <DayButton
          {...props}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            handleDayPointerDown(props.day.date, e.clientX, e.clientY);
            props.onMouseDown?.(e);
          }}
        />
      ),
    };
  }, [dragSelectionEnabled, handleDayPointerDown]);

  const pickerClassNames = useMemo(
    () =>
      mergeDayPickerClassNames({
        root: cn('w-full', transitionCell, isPointerDragging && 'select-none'),
        months: 'flex w-full flex-row flex-nowrap gap-6 sm:gap-8',
        weekday:
          'px-0 py-2 text-center text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground',
        day_button: cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium',
          'transition-all duration-150 ease-in-out',
          'hover:bg-muted/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        ),
        today:
          '[&_.rdp-day_button]:border [&_.rdp-day_button]:border-primary [&_.rdp-day_button]:text-primary',
        outside: 'opacity-35',
        disabled: 'opacity-35',
      }),
    [isPointerDragging]
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={triggerDisabled}
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn(
            'flex h-auto w-[300px] max-w-full items-center justify-between rounded-lg border border-input bg-white px-4 py-2.5 text-left text-sm font-normal shadow-sm transition hover:bg-gray-50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'dark:border-border dark:bg-background dark:hover:bg-muted/50',
            !displayText && 'text-muted-foreground',
            triggerDisabled && 'pointer-events-none opacity-50',
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate pr-2">{displayText ?? placeholder}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border bg-white p-0 shadow-xl dark:border-border dark:bg-popover"
        align="start"
        sideOffset={6}
      >
        <div className="flex max-h-[min(90vh,720px)] flex-col sm:max-h-none sm:flex-row">
          <nav
            className="flex shrink-0 flex-col gap-0.5 border-b border-border p-4 sm:w-[168px] sm:border-b-0 sm:border-r"
            aria-label="Accesos rápidos de fechas"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Presets
            </p>
            {PRESET_DEFS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  'cursor-pointer rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors duration-150',
                  'hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'dark:hover:bg-muted/80'
                )}
                onClick={() => applyPreset(p.range)}
              >
                {p.label}
              </button>
            ))}
          </nav>
          <div
            className="flex min-w-0 flex-1 flex-col p-4"
            onMouseLeave={handleCalendarMouseLeave}
          >
            <DayPicker
              locale={es}
              weekStartsOn={1}
              numberOfMonths={2}
              defaultMonth={defaultMonth}
              showOutsideDays
              animate
              disabled={disabledDays}
              components={pickerComponents}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              onDayClick={handleDaySelect}
              onDayKeyDown={handleDayKeyDown}
              onDayMouseEnter={handleDayMouseEnter}
              initialFocus
              className="w-full p-0"
              classNames={pickerClassNames}
            />
            <div className="mt-3 flex justify-between border-t border-border pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground hover:text-foreground"
                onClick={handleFooterHoy}
              >
                Hoy
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground hover:text-foreground"
                onClick={handleLimpiar}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
