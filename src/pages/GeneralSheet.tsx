import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ReportButton } from '@/components/ReportButton';
import { SearchableSelect } from '@/components/SearchableSelect';
import { MultiDateFilter } from '@/components/MultiDateFilter';
import { toast } from 'sonner';
import { CheckCircle2, RotateCcw, Search } from 'lucide-react';

export default function GeneralSheet() {
  const [orders, setOrders] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // filters
  const [officeFilter, setOfficeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: ords }, { data: offs }, { data: sts }] = await Promise.all([
      supabase.from('orders').select('id, barcode, customer_name, customer_phone, customer_code, product_name, price, delivery_price, address, governorate, office_id, status_id, received_at, created_at, sender_collected_at, sender_return_received_at, courier_collected_at, courier_return_received_at, order_statuses(name, color)').limit(5000),
      supabase.from('offices').select('id, name').order('name'),
      supabase.from('order_statuses').select('id, name, color').order('sort_order'),
    ]);
    setOrders(ords || []);
    setOffices(offs || []);
    setStatuses(sts || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Realtime: refresh on any order change
  useEffect(() => {
    const ch = supabase.channel('general-sheet')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const officeName = (id: string) => offices.find(o => o.id === id)?.name || '-';

  // Available dates from received_at (or created_at fallback)
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      const d = o.received_at || (o.created_at ? String(o.created_at).slice(0, 10) : null);
      if (d) set.add(String(d).slice(0, 10));
    });
    return Array.from(set).sort().reverse();
  }, [orders]);

  const filtered = useMemo(() => {
    let rows = orders.slice();
    if (officeFilter !== 'all') rows = rows.filter(o => o.office_id === officeFilter);
    if (statusFilter !== 'all') rows = rows.filter(o => o.status_id === statusFilter);
    if (dateFilter !== 'all') rows = rows.filter(o => {
      const d = o.received_at || (o.created_at ? String(o.created_at).slice(0, 10) : '');
      return String(d).slice(0, 10) === dateFilter;
    });
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(o =>
        (o.barcode || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(q) ||
        (o.customer_code || '').toLowerCase().includes(q)
      );
    }
    // Sort: received_at asc, then office name asc
    rows.sort((a, b) => {
      const da = a.received_at || String(a.created_at || '').slice(0, 10);
      const db = b.received_at || String(b.created_at || '').slice(0, 10);
      if (da !== db) return da < db ? -1 : 1;
      return officeName(a.office_id).localeCompare(officeName(b.office_id), 'ar');
    });
    return rows;
  }, [orders, officeFilter, statusFilter, dateFilter, search, offices]);

  const totalPrice = filtered.reduce((s, o) => s + Number(o.price || 0), 0);
  const totalShipping = filtered.reduce((s, o) => s + Number(o.delivery_price || 0), 0);
  const grandTotal = totalPrice + totalShipping;

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(o => o.id)));
  };

  const stampCollected = async () => {
    if (!selected.size) return toast.error('اختر أوردرات أولاً');
    const now = new Date().toISOString();
    const { error } = await supabase.from('orders')
      .update({ sender_collected_at: now })
      .in('id', Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`تم تسجيل تحصيل ${selected.size} أوردر للتاجر`);
    setSelected(new Set());
    load();
  };

  const stampReturned = async () => {
    if (!selected.size) return toast.error('اختر أوردرات أولاً');
    const now = new Date().toISOString();
    const { error } = await supabase.from('orders')
      .update({ sender_return_received_at: now })
      .in('id', Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`تم تسجيل رجوع مرتجع ${selected.size} أوردر للتاجر`);
    setSelected(new Set());
    load();
  };

  const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('ar-EG') : '-';
  const fmtDateTime = (v: any) => v ? new Date(v).toLocaleString('ar-EG') : '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">الشيت العمومي</h1>
        <ReportButton
          meta={{
            title: 'الشيت العمومي',
            filtersText: [
              officeFilter !== 'all' ? `التاجر: ${officeName(officeFilter)}` : null,
              statusFilter !== 'all' ? `الحالة: ${statuses.find(s => s.id === statusFilter)?.name}` : null,
              dateFilter !== 'all' ? `تاريخ الاستلام: ${dateFilter}` : null,
              search ? `بحث: ${search}` : null,
            ].filter(Boolean).join(' | '),
            summary: [
              { label: 'عدد الأوردرات', value: filtered.length },
              { label: 'إجمالي السعر', value: `${totalPrice} ج.م` },
              { label: 'إجمالي الشحن', value: `${totalShipping} ج.م` },
              { label: 'الإجمالي الكلي', value: `${grandTotal} ج.م` },
            ],
          }}
          columns={[
            { key: 'barcode', label: 'الباركود' },
            { key: 'received_at', label: 'تاريخ الاستلام', format: fmtDate },
            { key: 'office_id', label: 'التاجر', format: (v) => officeName(v) },
            { key: 'customer_code', label: 'كود العميل' },
            { key: 'customer_name', label: 'العميل' },
            { key: 'customer_phone', label: 'الهاتف' },
            { key: 'governorate', label: 'المحافظة' },
            { key: 'address', label: 'العنوان' },
            { key: 'product_name', label: 'الطلب' },
            { key: 'price', label: 'السعر' },
            { key: 'delivery_price', label: 'الشحن' },
            { key: 'order_statuses', label: 'الحالة', format: (v: any) => v?.name || '-' },
            { key: 'sender_collected_at', label: 'تاريخ التحصيل للتاجر', format: fmtDateTime },
            { key: 'sender_return_received_at', label: 'رجوع المرتجع للراسل', format: fmtDateTime },
          ]}
          rows={filtered}
          hideWhatsapp
        />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">التاجر</Label>
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">تاريخ الاستلام</Label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأيام ({availableDates.length})</SelectItem>
              {availableDates.map(d => <SelectItem key={d} value={d}>{new Date(d).toLocaleDateString('ar-EG')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">الحالة</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">بحث</Label>
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="باركود / اسم / هاتف" className="w-56 pr-8 bg-secondary border-border" />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold">محدد: {selected.size}</span>
            <Button size="sm" onClick={stampCollected} className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> تم التحصيل للتاجر
            </Button>
            <Button size="sm" variant="outline" onClick={stampReturned} className="gap-1">
              <RotateCcw className="h-4 w-4" /> رجوع المرتجع للراسل
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-10">
                    <Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">تاريخ الاستلام</TableHead>
                  <TableHead className="text-right">التاجر</TableHead>
                  <TableHead className="text-right">كود</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">المحافظة</TableHead>
                  <TableHead className="text-right">الطلب</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تحصيل للتاجر</TableHead>
                  <TableHead className="text-right">رجوع المرتجع للراسل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : filtered.map(o => {
                  const status: any = o.order_statuses;
                  return (
                    <TableRow key={o.id} className="border-border">
                      <TableCell>
                        <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                      <TableCell className="text-xs">{fmtDate(o.received_at || o.created_at)}</TableCell>
                      <TableCell className="text-sm font-medium">{officeName(o.office_id)}</TableCell>
                      <TableCell className="text-xs">{o.customer_code || '-'}</TableCell>
                      <TableCell className="text-sm">{o.customer_name}</TableCell>
                      <TableCell dir="ltr" className="text-sm">{o.customer_phone}</TableCell>
                      <TableCell className="text-sm">{o.governorate || '-'}</TableCell>
                      <TableCell className="text-sm">{o.product_name || '-'}</TableCell>
                      <TableCell className="text-sm">{o.price} ج.م</TableCell>
                      <TableCell className="text-sm">{o.delivery_price} ج.م</TableCell>
                      <TableCell>
                        {status ? (
                          <Badge style={{ backgroundColor: status.color, color: '#fff' }}>{status.name}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-xs">{fmtDateTime(o.sender_collected_at)}</TableCell>
                      <TableCell className="text-xs">{fmtDateTime(o.sender_return_received_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {filtered.length > 0 && (
                <TableFooter>
                  <TableRow className="border-border bg-muted/50">
                    <TableCell colSpan={9} className="font-bold">الإجمالي ({filtered.length})</TableCell>
                    <TableCell className="font-bold">{totalPrice} ج.م</TableCell>
                    <TableCell className="font-bold">{totalShipping} ج.م</TableCell>
                    <TableCell colSpan={3} className="font-bold">المجموع: {grandTotal} ج.م</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
