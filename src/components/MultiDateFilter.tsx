import { useMemo, useState } from 'react';
import { ChevronsUpDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface Props {
  /** Already-deduped, sorted list of available date strings (YYYY-MM-DD). */
  dates: string[];
  /** Currently selected dates. Empty array means "All". */
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  triggerClassName?: string;
}

/** Multi-select date filter — only shows dates with data ("smart"). Empty = all. */
export function MultiDateFilter({ dates, value, onChange, placeholder = 'كل الأيام', triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    if (!search.trim()) return dates;
    return dates.filter(d => d.includes(search.trim()));
  }, [dates, search]);

  const toggle = (d: string) => {
    if (value.includes(d)) onChange(value.filter(x => x !== d));
    else onChange([...value, d]);
  };
  const selectAll = () => onChange(dates.slice());
  const clear = () => onChange([]);

  const label = value.length === 0
    ? `${placeholder} (${dates.length})`
    : value.length === 1
      ? new Date(value[0]).toLocaleDateString('ar-EG')
      : `${value.length} أيام محددة`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn('w-56 justify-between bg-secondary border-border font-normal', triggerClassName)}
        >
          <span className="truncate flex items-center gap-1">
            {value.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1 text-[10px]">{value.length}</Badge>
            )}
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 mr-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border-border pointer-events-auto" align="start">
        <div className="p-2 border-b border-border space-y-2">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث (مثل 2025-04)"
            className="h-8 bg-secondary border-border text-xs"
          />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={selectAll}>تحديد الكل</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={clear}>
              <X className="h-3 w-3 ml-1" />إلغاء
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {visible.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">لا توجد تواريخ</div>
          ) : visible.map(d => (
            <label
              key={d}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded cursor-pointer text-sm"
            >
              <Checkbox checked={value.includes(d)} onCheckedChange={() => toggle(d)} />
              <span className="flex-1">{new Date(d).toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
              {value.includes(d) && <Check className="h-3 w-3 text-primary" />}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
