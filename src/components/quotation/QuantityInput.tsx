import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';

const DEFAULT_PRESETS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  presets?: number[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

const QuantityInput = ({
  value,
  onChange,
  presets,
  disabled,
  placeholder = 'Qty',
  className = '',
  id,
}: QuantityInputProps) => {
  const [open, setOpen] = useState(false);
  const options = Array.from(new Set([...(presets ?? []), ...DEFAULT_PRESETS])).sort((a, b) => a - b);

  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        min={1}
        disabled={disabled}
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(parseInt(e.target.value) || 1)}
        className={`pr-6 ${className}`}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Choose quantity"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-primary disabled:opacity-40"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-24 p-1 max-h-56 overflow-y-auto z-[100]">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                onChange(n);
                setOpen(false);
              }}
              className={`w-full rounded px-2 py-1 text-center text-sm hover:bg-accent ${
                n === value ? 'bg-accent text-accent-foreground font-semibold' : ''
              }`}
            >
              {n}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default QuantityInput;
