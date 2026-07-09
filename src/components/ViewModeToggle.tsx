import { LayoutGrid, List, Table2, Columns3 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type ViewMode = 'grid' | 'list' | 'table' | 'kanban';

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  storageKey?: string;
}

const MODES: { key: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { key: 'grid', label: 'Grid (cards)', Icon: LayoutGrid },
  { key: 'list', label: 'Compact list', Icon: List },
  { key: 'table', label: 'Table', Icon: Table2 },
  { key: 'kanban', label: 'Kanban', Icon: Columns3 },
];

export const ViewModeToggle = ({ value, onChange, storageKey }: Props) => {
  const set = (v: ViewMode) => {
    onChange(v);
    if (storageKey) {
      try { localStorage.setItem(storageKey, v); } catch {}
    }
  };
  return (
    <div className="inline-flex gap-1 rounded-lg bg-secondary/50 p-1 border border-primary/10">
      {MODES.map(({ key, label, Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <button
              onClick={() => set(key)}
              aria-label={label}
              aria-pressed={value === key}
              className={`p-1.5 rounded-md transition-colors ${
                value === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};

export const loadViewMode = (storageKey: string, fallback: ViewMode = 'grid'): ViewMode => {
  try {
    const v = localStorage.getItem(storageKey) as ViewMode | null;
    if (v === 'grid' || v === 'list' || v === 'table' || v === 'kanban') return v;
  } catch {}
  return fallback;
};
