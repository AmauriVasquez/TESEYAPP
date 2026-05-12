import React from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { mergeDayPickerClassNames } from '@/components/ui/day-picker-classnames';

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      locale={es}
      weekStartsOn={1}
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={mergeDayPickerClassNames({
        selected:
          '[&_.rdp-day_button]:bg-blue-600 [&_.rdp-day_button]:text-white [&_.rdp-day_button]:border-blue-600',
        today: '[&_.rdp-day_button]:ring-1 [&_.rdp-day_button]:ring-blue-300',
        outside: 'opacity-50',
        disabled: 'opacity-50',
        ...classNames,
      })}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
