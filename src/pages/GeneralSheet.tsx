import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReportButton } from '@/components/ReportButton';
import { SearchableSelect } from '@/components/SearchableSelect';
import { MultiSearchableSelect } from '@/components/MultiSearchableSelect';
import { MultiDateFilter } from '@/components/MultiDateFilter';
import { toast } from 'sonner';
import { CheckCircle2, RotateCcw, Search, Eraser, Pencil } from 'lucide-react';
import { computeOrderTotal } from '@/lib/orderCalc';

const NO_DATE = '__none__';

export default function GeneralSheet() {
  const [orders, setOrders] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // filters (all multi-select)
  const [officeFilter, setOfficeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [courierFilter, setCourierFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string[]>([]);                 // received_at
  const [senderCollectedFilter, setSenderCollectedFilter] = useState<string[]>([]);
  const [senderReturnFilter, setSenderReturnFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  // edit status dialog
  const [editRow, setEditRow] = useState<any>(null);
  const [editStatusId, setEditStatusId] = useState('');
  const [editPartial, setEditPartial] = useState('');
  const [editShippingPaid, setEditShippingPaid] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: ords }, { data: offs }, { data: sts }, { data: courierRoles }] = await Promise.all([
      supabase.from('orders').select('id, barcode, customer_name, customer_phone, customer_code, product_name, price, delivery_price, partial_amount, shipping_paid, address, governorate, office_id, courier_id, status_id, received_at, courier_received_at, created_at, sender_collected_at, sender_return_received_at, courier_collected_at, courier_return_received_at, order_statuses(name, color)').limit(5000),
      supabase.from('offices').select('id, name').order('name'),
      supabase.from('order_statuses').select('id, name, color').order('sort_order'),
      supabase.from('user_roles').select('user_id').eq('role', 'courier'),
    ]);
    setOrders(ords || []);
    setOffices(offs || []);
    setStatuses(sts || []);
    const ids = (courierRoles || []).map((r: any) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      setCouriers(profs || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel('general-sheet')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const officeName = (id: string) => offices.find(o => o.id === id)?.name || '-';
  const courierName = (id: string) => couriers.find(c => c.id === id)?.full_name || '-';

  const availableReceived = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      const d = o.received_at || (o.created_at ? String(o.created_at).slice(0, 10) : null);
      if (d) set.add(String(d).slice(0, 10));
    });
    return Array.from(set).sort().reverse();
  }, [orders]);

  const availableSenderCollected = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.sender_collected_at) set.add(String(o.sender_collected_at).slice(0, 10)); });
    return Array.from(set).sort().reverse();
  }, [orders]);

  const availableSenderReturn = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.sender_return_received_at) set.add(String(o.sender_return_received_at).slice(0, 10)); });
    return Array.from(set).sort().reverse();
  }, [orders]);

  const matchDateFilter = (filter: string[], available: string[], dateStr: string | null) => {
    if (filter.length === 0) return true;
    const wantsEmpty = filter.includes(NO_DATE);
    if (!dateStr) return wantsEmpty;
    return filter.includes(dateStr) || (wantsEmpty && available.includes(dateStr) === false);
  };

  const filtered = useMemo(() => {
    let rows = orders.slice();
    if (officeFilter.length) rows = rows.filter(o => officeFilter.includes(o.office_id));
    if (statusFilter.length) rows = rows.filter(o => statusFilter.includes(o.status_id));
    if (courierFilter.length) rows = rows.filter(o => courierFilter.includes(o.courier_id || ''));
    if (dateFilter.length) rows = rows.filter(o => {
      const d = o.received_at || (o.created_at ? String(o.created_at).slice(0, 10) : '');
      return matchDateFilter(dateFilter, availableReceived, d ? String(d).slice(0, 10) : null);
    });
    if (senderCollectedFilter.length) rows = rows.filter(o => {
      const d = o.sender_collected_at ? String(o.sender_collected_at).slice(0, 10) : null;
      return matchDateFilter(senderCollectedFilter, availableSenderCollected, d);
    });
    if (senderReturnFilter.length) rows = rows.filter(o => {
      const d = o.sender_return_received_at ? String(o.sender_return_received_at).slice(0, 10) : null;
      return matchDateFilter(senderReturnFilter, availableSenderReturn, d);
    });
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(o =>
        (o.barcode || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(q) ||
        (o.customer_code || '').toLowerCase().includes(q) ||
        (o.address || '').toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      const da = a.received_at || String(a.created_at || '').slice(0, 10);
      const db = b.received_at || String(b.created_at || '').slice(0, 10);
      if (da !== db) return da < db ? -1 : 1;
      return officeName(a.office_id).localeCompare(officeName(b.office_id), 'ar');
    });
    return rows;
  }, [orders, officeFilter, statusFilter, courierFilter, dateFilter, senderCollectedFilter, senderReturnFilter, search, offices, availableReceived, availableSenderCollected, availableSenderReturn]);

  const totalPrice = filtered.reduce((s, o) => s + Number(o.price || 0), 0);
  const totalShipping = filtered.reduce((s, o) => s + Number(o.delivery_price || 0), 0);
  const grandTotal = totalPrice + totalShipping;

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map(o => o.id)));

  const selectedRows = useMemo(() => filtered.filter(o => selected.has(o.id)), [filtered, selected]);
  const anySelectedHasCollected = selectedRows.some(o => !!o.sender_collected_at);
  const anySelectedHasReturned = selectedRows.some(o => !!o.sender_return_received_at);

  const stamp = async (field: 'sender_collected_at' | 'sender_return_received_at', clear: boolean) => {
    if (!selected.size) return toast.error('اختر أوردرات أولاً');
    const value = clear ? null : new Date().toISOString();
    const { error } = await supabase.from('orders').update({ [field]: value }).in('id', Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(clear ? 'تم إلغاء التاريخ' : 'تم تسجيل التاريخ');
    setSelected(new Set()); load();
  };

  // Status edit
  const openEdit = (row: any) => {
    setEditRow(row);
    setEditStatusId(row.status_id || '');
    setEditPartial(String(row.partial_amount || ''));
    setEditShippingPaid(String(row.shipping_paid || ''));
  };
  const saveEdit = async () => {
    if (!editRow || !editStatusId) return;
    const status = statuses.find(s => s.id === editStatusId);
    const update: any = { status_id: editStatusId };
    if (status?.name === 'تسليم جزئي' || status?.name === 'استلم ودفع نص الشحن') {
      const v = parseFloat(editPartial);
      if (isNaN(v) || v <= 0) return toast.error('أدخل القيمة المحصلة');
      update.partial_amount = v;
    }
    if (status?.name === 'رفض ودفع شحن' || status?.name === 'رفض دفع شحن') {
      const v = parseFloat(editShippingPaid);
      if (!isNaN(v) && v > 0) update.shipping_paid = v;
    }
    const { error } = await supabase.from('orders').update(update).eq('id', editRow.id);
    if (error) return toast.error(error.message);
    toast.success('تم التعديل');
    setEditRow(null); load();
  };

  const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('ar-EG') : '-';
  const fmtDateTime = (v: any) => v ? new Date(v).toLocaleString('ar-EG') : '-';

  const editStatus = statuses.find(s => s.id === editStatusId);
  const needsPartial = editStatus?.name === 'تسليم جزئي' || editStatus?.name === 'استلم ودفع نص الشحن';
  const needsShipping = editStatus?.name === 'رفض ودفع شحن' || editStatus?.name === 'رفض دفع شحن';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">الشيت العمومي</h1>
        <ReportButton
          meta={{
            title: 'الشيت العمومي',
            filtersText: [
              officeFilter.length ? `التجار: ${officeFilter.map(officeName).join('، ')}` : null,
              statusFilter.length ? `الحالة: ${statusFilter.map(id => statuses.find(s => s.id === id)?.name).filter(Boolean).join('، ')}` : null,
              dateFilter.length ? `تاريخ الاستلام: ${dateFilter.join('، ')}` : null,
              senderCollectedFilter.length ? `تحصيل للتاجر: ${senderCollectedFilter.join('، ')}` : null,
              senderReturnFilter.length ? `مرتجع للتاجر: ${senderReturnFilter.join('، ')}` : null,
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
            { key: 'customer_code', label: 'كود الراسل' },
            { key: 'office_id', label: 'الراسل', format: (v) => officeName(v) },
            { key: 'customer_name', label: 'العميل' },
            { key: 'address', label: 'العنوان' },
            { key: 'customer_phone', label: 'الهاتف' },
            { key: 'price', label: 'السعر' },
            { key: 'delivery_price', label: 'الشحن' },
            { key: 'total', label: 'الإجمالي', format: (_: any, r: any) => computeOrderTotal(r) },
            { key: 'courier_id', label: 'المندوب', format: (v) => courierName(v) },
            { key: 'courier_received_at', label: 'تاريخ استلام المندوب', format: fmtDate },
            { key: 'order_statuses', label: 'الحالة', format: (v: any) => v?.name || '-' },
            { key: 'courier_collected_at', label: 'تحصيل المندوب', format: fmtDateTime },
            { key: 'courier_return_received_at', label: 'مرتجع المندوب', format: fmtDateTime },
            { key: 'sender_collected_at', label: 'تحصيل التاجر', format: fmtDateTime },
            { key: 'sender_return_received_at', label: 'مرتجع التاجر', format: fmtDateTime },
          ]}
          rows={filtered}
          selectedRows={selectedRows}
          hideWhatsapp
        />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">التاجر (متعدد)</Label>
          <MultiSearchableSelect options={offices.map(o => ({ value: o.id, label: o.name }))} value={officeFilter} onChange={setOfficeFilter} placeholder="كل التجار" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">المندوب (متعدد)</Label>
          <MultiSearchableSelect options={[{ value: '', label: 'غير معين' }, ...couriers.map(c => ({ value: c.id, label: c.full_name }))]} value={courierFilter} onChange={setCourierFilter} placeholder="كل المناديب" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">الحالة (متعدد)</Label>
          <MultiSearchableSelect options={statuses.map(s => ({ value: s.id, label: s.name }))} value={statusFilter} onChange={setStatusFilter} placeholder="كل الحالات" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">تاريخ الاستلام</Label>
          <MultiDateFilter dates={availableReceived} value={dateFilter} onChange={setDateFilter} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">تاريخ تحصيل التاجر</Label>
          <MultiDateFilter dates={[NO_DATE, ...availableSenderCollected]} value={senderCollectedFilter} onChange={setSenderCollectedFilter} placeholder="كل التواريخ + الفارغ" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">تاريخ مرتجع التاجر</Label>
          <MultiDateFilter dates={[NO_DATE, ...availableSenderReturn]} value={senderReturnFilter} onChange={setSenderReturnFilter} placeholder="كل التواريخ + الفارغ" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">بحث</Label>
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="باركود / اسم / هاتف / عنوان" className="w-56 pr-8 bg-secondary border-border" />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold">محدد: {selected.size}</span>
            <Button size="sm" onClick={() => stamp('sender_collected_at', false)} className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> تم التحصيل للتاجر
            </Button>
            <Button size="sm" variant="outline" onClick={() => stamp('sender_return_received_at', false)} className="gap-1">
              <RotateCcw className="h-4 w-4" /> رجوع المرتجع للراسل
            </Button>
            {anySelectedHasCollected && (
              <Button size="sm" variant="secondary" onClick={() => stamp('sender_collected_at', true)} className="gap-1">
                <Eraser className="h-4 w-4" /> إلغاء تاريخ تحصيل التاجر
              </Button>
            )}
            {anySelectedHasReturned && (
              <Button size="sm" variant="secondary" onClick={() => stamp('sender_return_received_at', true)} className="gap-1">
                <Eraser className="h-4 w-4" /> إلغاء تاريخ مرتجع التاجر
              </Button>
            )}
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
                  <TableHead className="w-10"><Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">كود الراسل</TableHead>
                  <TableHead className="text-right">الراسل</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">الإجمالي</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">استلام المندوب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تحصيل/مرتجع المندوب</TableHead>
                  <TableHead className="text-right">تحصيل التاجر</TableHead>
                  <TableHead className="text-right">مرتجع التاجر</TableHead>
                  <TableHead className="text-right w-10">تعديل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={17} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={17} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : filtered.map(o => {
                  const status: any = o.order_statuses;
                  return (
                    <TableRow key={o.id} className="border-border">
                      <TableCell><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} /></TableCell>
                      <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                      <TableCell className="text-xs">{o.customer_code || '-'}</TableCell>
                      <TableCell className="text-sm font-medium">{officeName(o.office_id)}</TableCell>
                      <TableCell className="text-sm">{o.customer_name}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={o.address}>{o.address || '-'}</TableCell>
                      <TableCell dir="ltr" className="text-sm">{o.customer_phone}</TableCell>
                      <TableCell className="text-sm">{o.price} ج.م</TableCell>
                      <TableCell className="text-sm">{o.delivery_price} ج.م</TableCell>
                      <TableCell className="text-sm font-bold">{computeOrderTotal(o)} ج.م</TableCell>
                      <TableCell className="text-sm">{o.courier_id ? courierName(o.courier_id) : '-'}</TableCell>
                      <TableCell className="text-xs">{fmtDate(o.courier_received_at)}</TableCell>
                      <TableCell>{status ? <Badge style={{ backgroundColor: status.color, color: '#fff' }}>{status.name}</Badge> : '-'}</TableCell>
                      <TableCell className="text-xs">
                        <div>تح: {fmtDateTime(o.courier_collected_at)}</div>
                        <div>مر: {fmtDateTime(o.courier_return_received_at)}</div>
                      </TableCell>
                      <TableCell className="text-xs">{fmtDateTime(o.sender_collected_at)}</TableCell>
                      <TableCell className="text-xs">{fmtDateTime(o.sender_return_received_at)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {filtered.length > 0 && (
                <TableFooter>
                  <TableRow className="border-border bg-muted/50">
                    <TableCell colSpan={7} className="font-bold">الإجمالي ({filtered.length})</TableCell>
                    <TableCell className="font-bold">{totalPrice} ج.م</TableCell>
                    <TableCell className="font-bold">{totalShipping} ج.م</TableCell>
                    <TableCell className="font-bold text-primary">{grandTotal} ج.م</TableCell>
                    <TableCell colSpan={7} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Status edit dialog */}
      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>تعديل حالة الأوردر</DialogTitle></DialogHeader>
          {editRow && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {editRow.customer_name} — باركود {editRow.barcode}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الحالة الجديدة</Label>
                <SearchableSelect
                  options={statuses.map(s => ({ value: s.id, label: s.name }))}
                  value={editStatusId}
                  onChange={setEditStatusId}
                  triggerClassName="w-full"
                />
              </div>
              {needsPartial && (
                <div className="space-y-1">
                  <Label className="text-xs">القيمة المحصلة فعلياً (ج.م) *</Label>
                  <Input type="number" value={editPartial} onChange={e => setEditPartial(e.target.value)} className="bg-secondary border-border" />
                </div>
              )}
              {needsShipping && (
                <div className="space-y-1">
                  <Label className="text-xs">قيمة الشحن المدفوعة (ج.م)</Label>
                  <Input type="number" value={editShippingPaid} onChange={e => setEditShippingPaid(e.target.value)} className="bg-secondary border-border" />
                </div>
              )}
              <Button onClick={saveEdit} className="w-full">حفظ</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
