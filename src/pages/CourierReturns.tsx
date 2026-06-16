import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ReportButton } from '@/components/ReportButton';
import { SearchableSelect } from '@/components/SearchableSelect';
import { MultiDateFilter } from '@/components/MultiDateFilter';

export default function CourierReturns() {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState<string>('all');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'courier');
      if (roles?.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', roles.map(r => r.user_id));
        setCouriers(profiles || []);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      let q = supabase.from('orders')
        .select('id, barcode, customer_code, customer_name, customer_phone, address, price, delivery_price, courier_id, courier_return_received_at, order_statuses(name, color)')
        .not('courier_return_received_at', 'is', null)
        .order('courier_return_received_at', { ascending: false });
      if (selectedCourier !== 'all') q = q.eq('courier_id', selectedCourier);
      const { data } = await q;
      setOrders(data || []);
      setSelectedDates([]);
      setSelected(new Set());
    })();
  }, [selectedCourier]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.courier_return_received_at) set.add(String(o.courier_return_received_at).slice(0, 10)); });
    return Array.from(set).sort().reverse();
  }, [orders]);

  const filtered = useMemo(() => selectedDates.length === 0
    ? orders
    : orders.filter(o => selectedDates.includes(String(o.courier_return_received_at).slice(0, 10))),
    [orders, selectedDates]);

  const getCourierName = (id: string) => couriers.find(c => c.id === id)?.full_name || '-';
  const totalPrice = filtered.reduce((s, o) => s + Number(o.price || 0), 0);
  const totalShipping = filtered.reduce((s, o) => s + Number(o.delivery_price || 0), 0);

  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(o => o.id)));
  const selectedRows = filtered.filter(o => selected.has(o.id));

  const courierOptions = [{ value: 'all', label: 'كل المناديب' }, ...couriers.map(c => ({ value: c.id, label: c.full_name }))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">مرتجعات المناديب</h1>
        <ReportButton
          meta={{
            title: 'مرتجعات المناديب',
            filtersText: [
              selectedCourier !== 'all' ? `المندوب: ${getCourierName(selectedCourier)}` : null,
              selectedDates.length ? `التواريخ: ${selectedDates.join('، ')}` : null,
            ].filter(Boolean).join(' | '),
            summary: [
              { label: 'عدد السجلات', value: filtered.length },
              { label: 'إجمالي السعر', value: `${totalPrice} ج.م` },
              { label: 'إجمالي الشحن', value: `${totalShipping} ج.م` },
            ],
          }}
          columns={[
            { key: 'barcode', label: 'الباركود' },
            { key: 'customer_code', label: 'كود الراسل' },
            { key: 'customer_name', label: 'العميل' },
            { key: 'customer_phone', label: 'الهاتف' },
            { key: 'address', label: 'العنوان' },
            { key: 'courier_id', label: 'المندوب', format: (v) => getCourierName(v) },
            { key: 'price', label: 'السعر' },
            { key: 'delivery_price', label: 'الشحن' },
            { key: 'order_statuses', label: 'الحالة', format: (v: any) => v?.name || '-' },
            { key: 'courier_return_received_at', label: 'تاريخ رجوع المرتجع' },
          ]}
          rows={filtered}
          selectedRows={selectedRows}
          hideWhatsapp
        />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">المندوب</Label>
          <SearchableSelect options={courierOptions} value={selectedCourier} onChange={setSelectedCourier} placeholder="كل المناديب" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">تاريخ رجوع المرتجع (متعدد)</Label>
          <MultiDateFilter dates={availableDates} value={selectedDates} onChange={setSelectedDates} />
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-10">
                    <Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">كود الراسل</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ رجوع المرتجع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                ) : filtered.map(o => (
                  <TableRow key={o.id} className="border-border">
                    <TableCell><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                    <TableCell className="text-xs">{o.customer_code || '-'}</TableCell>
                    <TableCell className="text-sm">{o.customer_name}</TableCell>
                    <TableCell dir="ltr" className="text-sm">{o.customer_phone}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={o.address}>{o.address || '-'}</TableCell>
                    <TableCell className="text-sm">{getCourierName(o.courier_id)}</TableCell>
                    <TableCell className="text-sm">{o.price} ج.م</TableCell>
                    <TableCell className="text-sm">{o.delivery_price} ج.م</TableCell>
                    <TableCell className="text-sm">{(o.order_statuses as any)?.name || '-'}</TableCell>
                    <TableCell className="text-xs">{new Date(o.courier_return_received_at).toLocaleString('ar-EG')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {filtered.length > 0 && (
                <TableFooter>
                  <TableRow className="border-border bg-muted/50">
                    <TableCell colSpan={7} className="font-bold">الإجمالي ({filtered.length})</TableCell>
                    <TableCell className="font-bold">{totalPrice} ج.م</TableCell>
                    <TableCell className="font-bold">{totalShipping} ج.م</TableCell>
                    <TableCell colSpan={2} />
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
