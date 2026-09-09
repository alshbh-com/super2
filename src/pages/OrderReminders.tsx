import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlarmClock, Clock, Truck } from 'lucide-react';

const FINAL_STATUSES = ['تم التسليم', 'مرتجع', 'ملغي', 'مرتجع لم يدفع شحن'];

export default function OrderReminders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [courierFilter, setCourierFilter] = useState('all');
  const [hours, setHours] = useState(48);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [{ data: ords }, { data: roles }] = await Promise.all([
      supabase.from('orders').select('*, order_statuses(name, color), offices(name)').eq('is_closed', false).order('created_at', { ascending: true }).limit(3000),
      supabase.from('user_roles').select('user_id').eq('role', 'courier'),
    ]);
    setOrders(ords || []);
    if (roles?.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', roles.map(r => r.user_id));
      setCouriers(profs || []);
    }
  };

  const courierName = (id: string) => couriers.find(c => c.id === id)?.full_name || '-';

  const late = useMemo(() => {
    const limit = Date.now() - hours * 3600 * 1000;
    return orders.filter(o => {
      const st = o.order_statuses?.name;
      if (st && FINAL_STATUSES.includes(st)) return false;
      const base = new Date(o.received_at || o.created_at).getTime();
      if (base > limit) return false;
      if (courierFilter !== 'all' && o.courier_id !== courierFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hit = [o.barcode, o.customer_name, o.customer_phone, o.address].some(v => (v || '').toString().toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [orders, hours, courierFilter, search, couriers]);

  const ageHours = (o: any) => Math.floor((Date.now() - new Date(o.received_at || o.created_at).getTime()) / 3600000);

  const byCourier = useMemo(() => {
    const m = new Map<string, number>();
    late.forEach(o => m.set(o.courier_id || 'none', (m.get(o.courier_id || 'none') || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [late]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlarmClock className="h-6 w-6 text-primary" />تذكير بالأوردرات</h1>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">أقدم من (ساعة)</Label>
            <Input type="number" value={hours} onChange={e => setHours(Number(e.target.value) || 0)} className="h-9 w-28 bg-secondary border-border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">المندوب</Label>
            <Select value={courierFilter} onValueChange={setCourierFilter}>
              <SelectTrigger className="h-9 w-48 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المناديب</SelectItem>
                {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">بحث</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="باركود / عميل / هاتف" className="h-9 w-56 bg-secondary border-border" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-rose-50 border-rose-200"><CardContent className="p-3 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-rose-600" />
          <p className="text-xs text-rose-700">أوردرات متأخرة</p>
          <p className="text-2xl font-bold text-rose-700">{late.length}</p>
        </CardContent></Card>
        {byCourier.slice(0, 3).map(([cid, count]) => (
          <Card key={cid} className="bg-card border-border"><CardContent className="p-3 text-center">
            <Truck className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">{cid === 'none' ? 'بدون مندوب' : courierName(cid)}</p>
            <p className="text-2xl font-bold">{count}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">التاجر</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-right">مر عليها</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {late.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد أوردرات متأخرة 🎉</TableCell></TableRow>
                ) : late.map((o, i) => (
                  <TableRow key={o.id} className="border-border">
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                    <TableCell className="text-sm">{o.customer_name}</TableCell>
                    <TableCell dir="ltr" className="text-xs">{o.customer_phone || '-'}</TableCell>
                    <TableCell className="text-sm">{o.offices?.name || '-'}</TableCell>
                    <TableCell className="text-sm">{o.courier_id ? courierName(o.courier_id) : '-'}</TableCell>
                    <TableCell className="text-center">
                      {o.order_statuses?.name
                        ? <Badge style={{ backgroundColor: (o.order_statuses.color || '#888') + '30', color: o.order_statuses.color }} className="text-xs">{o.order_statuses.name}</Badge>
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm font-bold text-rose-600">{ageHours(o)} ساعة</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
