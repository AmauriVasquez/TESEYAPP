import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const DEBOUNCE_MS = 300;

const Combobox = ({ options = [], value, onChange = () => {}, placeholder, searchPlaceholder, notFoundMessage }) => {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value ?? '');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    setInputValue(value ?? '');
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebouncedSearch(inputValue.trim().toLowerCase()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [inputValue, open]);

  const filteredOptions = React.useMemo(() => {
    if (!debouncedSearch) return options;
    return options.filter((opt) => (opt.label ?? '').toLowerCase().includes(debouncedSearch));
  }, [options, debouncedSearch]);

  const handleSelect = React.useCallback((currentValue) => {
    const newValue = currentValue === value ? '' : currentValue;
    onChange(newValue);
    setInputValue(newValue);
    setOpen(false);
  }, [value, onChange]);

  const selectedLabel = value ? (options.find((opt) => opt.value === value)?.label ?? value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left"
        >
          {selectedLabel != null ? (
            <span className="truncate">{selectedLabel}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false} filter={() => 1}>
          <CommandInput placeholder={searchPlaceholder} value={inputValue} onValueChange={setInputValue} />
          <CommandEmpty>{notFoundMessage}</CommandEmpty>
          <CommandGroup className="max-h-60 overflow-y-auto">
            {filteredOptions.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={handleSelect}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === option.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export { Combobox };