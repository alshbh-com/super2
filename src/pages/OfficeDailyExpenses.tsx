import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Trash2, Truck, Building2, HandCoins, Receipt, CalendarClock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ReportButton } from '@/components/ReportButton';
import { useAuth } from '@/contexts/AuthContext';
import { SearchableSelect } from '@/components/SearchableSelect';

const CATEGORIES = [
  { key: 'shipments', label: 'مصاريف شحنات', icon: Truck, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  { key: 'office', label: 'مصاريف مكتب', icon: Building2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { key: 'salaries', label: 'مرتبات', icon: Users, color: 'text-violet-600 bg-violet-50 border-violet-200' },
  { key: 'rent', label: 'إيجار', icon: Building2, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { key: 'advances', label: 'سلف', icon: HandCoins, color: 'text-amber-600 bg-amber-50 border-amber-200' },
];

const d2s = (d: Date) => d.toISOString().split('T')[0];

const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: 'today', label: 'اليوم', range: () => [d2s(new Date()), d2s(new Date())] },
  {
    key: 'week', label: 'آخر 7 أيام', range: () => {
      const f = new Date(); f.setDate(f.getDate() - 6); return [d2s(f), d2s(new Date())];
    }
  },
  {
    key: 'month', label: 'الشهر الحالي', range: () => {
      const n = new Date(); return [d2s(new Date(n.getFullYear(), n.getMonth(), 1)), d2s(n)];
    }
  },
  {
    key: 'prev_month', label: 'الشهر الماضي', range: () => {
      const n = new Date();
      return [d2s(new Date(n.getFullYear(), n.getMonth() - 1, 1)), d2s(new Date(n.getFullYear(), n.getMonth(), 0))];
    }
  },
  {
    key: 'year', label: 'السنة الحالية', range: () => {
      const n = new Date(); return [d2s(new Date(n.getFullYear(), 0, 1)), d2s(n)];
    }
  },
];

export default function OfficeDailyExpenses() {
  const { user } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState<string>(() => PRESETS[2].range()[0]);
  const [to, setTo] = useState<string>(() => PRESETS[2].range()[1]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tab, setTab] = useState<'daily' | 'fixed'>('daily');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    expense_type: 'daily',
    office_id: '',
    expense_date: d2s(new Date()),
    category: 'office',
    amount: '',
    notes: '',
  });

  useEffect(() => {
    supabase.from('offices').select('id, name').order('name').then(({ data }) => setOffices(data || []));
  }, []);

  useEffect(() => { load(); }, [officeFilter, from, to, categoryFilter]);

  const applyPreset = (key: string) => {
    setPreset(key);
    const p = PRESETS.find(x => x.key === key);
    if (p) { const [f, t] = p.range(); setFrom(f); setTo(t); }
  };

  const load = async () => {
    let q = supabase.from('office_daily_expenses').select('*')
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: false });
    if (officeFilter !== 'all') q = q.eq('office_id', officeFilter);
    if (categoryFilter !== 'all') q = q.eq('category', categoryFilter);
    const { data } = await q;
    setItems(data || []);

    // صافي إيراد الشحن للفترة (سعر الشحن للأوردرات المحصلة)
    const { data: ords } = await supabase
      .from('orders')
      .select('delivery_price, shipping_paid, courier_collected_at')
      .gte('courier_collected_at', `${from}T00:00:00`)
      .lte('courier_collected_at', `${to}T23:59:59`)
      .limit(10000);
    const rev = (ords || []).reduce(
      (s: number, o: any) => s + Number(o.shipping_paid ?? o.delivery_price ?? 0), 0);
    setRevenue(rev);
  };

  const officeMap = useMemo(() => {
    const m: Record<string, string> = {};
    offices.forEach(o => { m[o.id] = o.name; });
    return m;
  }, [offices]);

  const daily = useMemo(() => items.filter(i => (i.expense_type || 'daily') !== 'fixed'), [items]);
  const fixed = useMemo(() => items.filter(i => i.expense_type === 'fixed'), [items]);
  const rows = tab === 'fixed' ? fixed : daily;

  const sum = (arr: any[]) => arr.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totals = useMemo(() => ({
    daily: sum(daily),
    fixed: sum(fixed),
    all: sum(items),
  }), [items, daily, fixed]);

  const save = async () => {
    if (!form.amount) { toast.error('أدخل المبلغ'); return; }
    const { error } = await supabase.from('office_daily_expenses').insert({
      expense_type: form.expense_type,
      office_id: form.office_id || null,
      expense_date: form.expense_date,
      category: form.category,
      amount: Number(form.amount),
      notes: form.notes,
      created_by: user?.id || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('تم الحفظ');
    setOpen(false);
    setForm({ ...form, amount: '', notes: '' });
    load();
  };

  const importSalaries = async () => {
    if (!confirm('ترحيل مرتبات كل الموظفين كمصروف ثابت لهذا الشهر؟')) return;
    const { data: profs } = await supabase.from('profiles').select('id, full_name, salary');
    const withSalary = (profs || []).filter((p: any) => Number(p.salary || 0) > 0);
    if (withSalary.length === 0) { toast.error('لا توجد مرتبات مسجلة'); return; }
    const n = new Date();
    const date = d2s(new Date(n.getFullYear(), n.getMonth(), 1));
    const { error } = await supabase.from('office_daily_expenses').insert(
      withSalary.map((p: any) => ({
        expense_type: 'fixed',
        office_id: null,
        expense_date: date,
        category: 'salaries',
        amount: Number(p.salary),
        notes: `مرتب: ${p.full_name || ''}`,
        created_by: user?.id || null,
      })) as any
    );
    if (error) { toast.error(error.message); return; }
    toast.success(`تم ترحيل ${withSalary.length} مرتب`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return;
    await supabase.from('office_daily_expenses').delete().eq('id', id);
    toast.success('تم الحذف');
    load();
  };

  const reportColumns = [
    { key: 'expense_date', label: 'التاريخ' },
    { key: 'office_name', label: 'المكتب', format: (_: any, r: any) => officeMap[r.office_id] || 'الشركة' },
    { key: 'category', label: 'التصنيف', format: (v: any) => CATEGORIES.find(c => c.key === v)?.label || v },
    { key: 'amount', label: 'المبلغ', format: (v: any) => `${Number(v).toLocaleString()} ج.م` },
    { key: 'notes', label: 'ملاحظة' },
  ];

  const meta = {
    title: 'مصروف الشركة',
    subtitle: `الفترة: ${from} → ${to}${officeFilter !== 'all' ? ` | ${officeMap[officeFilter] || ''}` : ''}`,
    filtersText: `${tab === 'fixed' ? 'مصاريف ثابتة شهرية' : 'مصاريف يومية'} | ${categoryFilter === 'all' ? 'كل التصنيفات' : CATEGORIES.find(c => c.key === categoryFilter)?.label}`,
    summary: [
      { label: 'إجمالي المصروفات', value: `${totals.all.toLocaleString()} ج.م` },
      { label: 'ثابتة شهرية', value: `${totals.fixed.toLocaleString()} ج.م` },
      { label: 'يومية', value: `${totals.daily.toLocaleString()} ج.م` },
      { label: 'صافي الإيراد بعد المصروفات', value: `${(revenue - totals.all).toLocaleString()} ج.م` },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">مصروف الشركة</h1>
        <div className="flex gap-2">
          <ReportButton meta={meta} columns={reportColumns} rows={rows} hideWhatsapp />
          <Button size="sm" variant="outline" onClick={importSalaries}>
            <Users className="h-4 w-4 ml-1" />ترحيل المرتبات
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة مصروف</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>إضافة مصروف</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>نوع المصروف</Label>
                  <Select value={form.expense_type} onValueChange={v => setForm({ ...form, expense_type: v })}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">مصروف يومي</SelectItem>
                      <SelectItem value="fixed">مصروف ثابت شهري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>التاريخ</Label>
                  <Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} className="bg-secondary border-border" />
                </div>
                <div>
                  <Label>القيمة *</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="bg-secondary border-border" />
                </div>
                <div>
                  <Label>التصنيف</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المكتب (اختياري)</Label>
                  <SearchableSelect
                    options={[{ value: '', label: 'الشركة (بدون مكتب)' }, ...offices.map(o => ({ value: o.id, label: o.name }))]}
                    value={form.office_id}
                    onChange={v => setForm({ ...form, office_id: v })}
                    placeholder="الشركة (بدون مكتب)"
                    triggerClassName="w-full"
                  />
                </div>
                <div>
                  <Label>ملاحظة</Label>
                  <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="bg-secondary border-border" placeholder="تفاصيل المصروف..." />
                </div>
                <Button onClick={save} className="w-full">حفظ</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Button key={p.key} size="sm" variant={preset === p.key ? 'default' : 'outline'} onClick={() => applyPreset(p.key)}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">من</Label>
              <Input type="date" value={from} onChange={e => { setPreset(''); setFrom(e.target.value); }} className="w-40 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">إلى</Label>
              <Input type="date" value={to} onChange={e => { setPreset(''); setTo(e.target.value); }} className="w-40 bg-secondary border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">المكتب</Label>
              <Select value={officeFilter} onValueChange={setOfficeFilter}>
                <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المكاتب</SelectItem>
                  {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">التصنيف</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/10 border-primary/30"><CardContent className="p-3 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <div><p className="text-xs text-muted-foreground">إجمالي المصروفات</p><p className="text-base font-bold text-primary">{totals.all.toLocaleString()} ج.م</p></div>
        </CardContent></Card>
        <Card className="bg-rose-50 border-rose-200"><CardContent className="p-3 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-rose-600" />
          <div><p className="text-xs text-muted-foreground">مصاريف ثابتة شهرية</p><p className="text-base font-bold">{totals.fixed.toLocaleString()} ج.م</p></div>
        </CardContent></Card>
        <Card className="bg-amber-50 border-amber-200"><CardContent className="p-3 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-amber-600" />
          <div><p className="text-xs text-muted-foreground">مصاريف يومية</p><p className="text-base font-bold">{totals.daily.toLocaleString()} ج.م</p></div>
        </CardContent></Card>
        <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-3 flex items-center gap-2">
          <Truck className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-xs text-muted-foreground">صافي بعد المصروفات (إيراد {revenue.toLocaleString()})</p>
            <p className="text-base font-bold">{(revenue - totals.all).toLocaleString()} ج.م</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">السجلات</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <div className="px-3">
              <TabsList className="grid grid-cols-2 w-full max-w-md">
                <TabsTrigger value="daily">مصاريف يومية ({daily.length})</TabsTrigger>
                <TabsTrigger value="fixed">مصاريف ثابتة شهرية ({fixed.length})</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value={tab} forceMount>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">المكتب</TableHead>
                      <TableHead className="text-right">التصنيف</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">ملاحظة</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد مصاريف</TableCell></TableRow>
                    ) : rows.map(i => {
                      const cat = CATEGORIES.find(c => c.key === i.category);
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="text-xs">{i.expense_date}</TableCell>
                          <TableCell className="text-sm font-medium">{officeMap[i.office_id] || 'الشركة'}</TableCell>
                          <TableCell><span className={`text-xs px-2 py-1 rounded ${cat?.color || ''}`}>{cat?.label || i.category}</span></TableCell>
                          <TableCell className="font-bold">{Number(i.amount).toLocaleString()} ج.م</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{i.notes || '-'}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(i.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
