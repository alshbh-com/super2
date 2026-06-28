import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export interface MSOption { value: string; label: string }

interface Props {
  options: MSOption[];
  value: string[];                 // empty array = ALL
  onChange: (v: string[]) => void;
  placeholder?: string;
  triggerClassName?: string;
}

/** Multi-select combobox with search. Empty selection means "all". */
export function MultiSearchableSelect({ options, value, onChange, placeholder = 'الكل', triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const visible = useMemo(
    () => !q.trim() ? options : options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase())),
    [options, q]
  );
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  const label =
    value.length === 0 ? `${placeholder} (${options.length})`
    : value.length === 1 ? (options.find(o => o.value === value[0])?.label || '1 محدد')
    : `${value.length} محددة`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" type="button"
          className={cn('w-48 justify-between bg-secondary border-border font-normal', triggerClassName)}>
          <span className="truncate flex items-center gap-1">
            {value.length > 0 && <Badge variant="secondary" className="h-5 px-1 text-[10px]">{value.length}</Badge>}
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 mr-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border-border pointer-events-auto" align="start">
        <div className="p-2 border-b border-border space-y-2">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." className="h-8 bg-secondary border-border text-xs" />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => onChange(options.map(o => o.value))}>الكل</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => onChange([])}>
              <X className="h-3 w-3 ml-1" />مسح
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {visible.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-4">لا نتائج</div>
          ) : visible.map(o => (
            <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded cursor-pointer text-sm">
              <Checkbox checked={value.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              <span className="flex-1 truncate">{o.label}</span>
              {value.includes(o.value) && <Check className="h-3 w-3 text-primary" />}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
