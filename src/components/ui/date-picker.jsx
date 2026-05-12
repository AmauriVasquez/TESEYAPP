import React, { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, isValid, parse, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { mergeDayPickerClassNames } from '@/components/ui/day-picker-classnames';

const ISO = 'yyyy-MM-dd';

function parseIsoDate(str) {
  if (!str || !String(str).trim()) return undefined;
  const d = startOfDay(parse(String(str).trim(), ISO, new Date()));
  return isValid(d) ? d : undefined;
}

/**
 * Una fecha (string yyyy-MM-dd).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className,
  id,
  disabled,
  'aria-label': ariaLabel = 'Seleccionar fecha',
}) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);

  const displayText = useMemo(() => {
    if (!selected) return null;
    return format(selected, 'dd/MMM/yyyy', { locale: es }).toLowerCase();
  }, [selected]);

  const defaultMonth = selected ?? new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'h-9 w-full cursor-pointer justify-between px-3 py-2 text-left font-normal shadow-sm',
            'hover:bg-accent/50 hover:border-input/80',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            !displayText && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{displayText ?? placeholder}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <DayPicker
          mode="single"
          locale={es}
          weekStartsOn={1}
          numberOfMonths={1}
          defaultMonth={defaultMonth}
          selected={selected}
          onSelect={(d) => {
            onChange(d ? format(startOfDay(d), ISO) : '');
            setOpen(false);
          }}
          showOutsideDays
          initialFocus
          className="p-3"
          classNames={mergeDayPickerClassNames({
            selected:
              '[&_.rdp-day_button]:bg-primary [&_.rdp-day_button]:text-primary-foreground [&_.rdp-day_button]:border-primary',
            outside: 'opacity-50',
            disabled: 'opacity-50',
          })}
        />
      </PopoverContent>
    </Popover>
  );
}
