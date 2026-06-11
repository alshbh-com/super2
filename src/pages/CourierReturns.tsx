import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function CourierReturns() {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [orders, setOrders] = useState<any[]>([]);

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
        .select('id, barcode, customer_name, customer_phone, price, delivery_price, courier_id, courier_return_received_at, order_statuses(name, color)')
        .not('courier_return_received_at', 'is', null)
        .order('courier_return_received_at', { ascending: false });
      if (selectedCourier !== 'all') q = q.eq('courier_id', selectedCourier);
      const { data } = await q;
      setOrders(data || []);
      setSelectedDate('all');
    })();
  }, [selectedCourier]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.courier_return_received_at) set.add(String(o.courier_return_received_at).slice(0, 10)); });
    return Array.from(set).sort().reverse();
  }, [orders]);

  const filtered = useMemo(() => selectedDate === 'all'
    ? orders
    : orders.filter(o => String(o.courier_return_received_at).slice(0, 10) === selectedDate),
    [orders, selectedDate]);

  const getCourierName = (id: string) => couriers.find(c => c.id === id)?.full_name || '-';
  const totalPrice = filtered.reduce((s, o) => s + Number(o.price || 0), 0);
  const totalShipping = filtered.reduce((s, o) => s + Number(o.delivery_price || 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">مرتجعات المناديب</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">المندوب</Label>
          <Select value={selectedCourier} onValueChange={setSelectedCourier}>
            <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">تاريخ رجوع المرتجع</Label>
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأيام ({availableDates.length})</SelectItem>
              {availableDates.map(d => <SelectItem key={d} value={d}>{new Date(d).toLocaleDateString('ar-EG')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ رجوع المرتجع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                ) : filtered.map(o => (
                  <TableRow key={o.id} className="border-border">
                    <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                    <TableCell className="text-sm">{o.customer_name}</TableCell>
                    <TableCell dir="ltr" className="text-sm">{o.customer_phone}</TableCell>
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
                    <TableCell colSpan={4} className="font-bold">الإجمالي ({filtered.length})</TableCell>
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
