import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MultiDateFilter } from '@/components/MultiDateFilter';
import { Printer, Package, Truck, Undo2, Calendar, Wallet } from 'lucide-react';

const dayOf = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

export default function DailyReport() {
  const [basis, setBasis] = useState<'collected' | 'created'>('collected');
  const [days, setDays] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<Record<string, any>>({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 180);
    const [ordersRes, statusRes, profRes] = await Promise.all([
      supabase.from('orders').select('*, offices(name)').gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(5000),
      supabase.from('order_statuses').select('*'),
      supabase.from('profiles').select('id, full_name, commission_amount'),
    ]);
    setOrders(ordersRes.data || []);
    setStatuses(statusRes.data || []);
    const map: Record<string, any> = {};
    (profRes.data || []).forEach((p: any) => { map[p.id] = p; });
    setCouriers(map);
  };

  const basisValue = (o: any) => (basis === 'collected' ? o.courier_collected_at : o.created_at);

  // Smart days: only days that actually have data for the chosen basis
  const availableDays = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { const d = dayOf(basisValue(o)); if (d) set.add(d); });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [orders, basis]);

  // Default to the most recent available day
  useEffect(() => {
    if (availableDays.length > 0) setDays([availableDays[0]]);
    else setDays([]);
  }, [basis, availableDays.length]);

  const filtered = useMemo(() => {
    if (days.length === 0) return orders.filter(o => !!dayOf(basisValue(o)));
    return orders.filter(o => days.includes(dayOf(basisValue(o))));
  }, [orders, days, basis]);

  const getStatus = (id: string) => statuses.find(s => s.id === id);

  const deliveredStatusIds = statuses.filter(s => ['تم التسليم', 'تسليم جزئي'].includes(s.name)).map(s => s.id);
  const returnedStatusIds = statuses.filter(s => ['مرتجع', 'رفض ودفع شحن', 'رفض ولم يدفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)).map(s => s.id);
  const rejectPaidShipId = statuses.find(s => s.name === 'رفض ودفع شحن')?.id;
  const halfShipId = statuses.find(s => s.name === 'استلم ودفع نص الشحن')?.id;
  const commissionableIds = statuses.filter(s => ['تم التسليم', 'تسليم جزئي', 'رفض ودفع شحن', 'استلم ودفع نص الشحن'].includes(s.name)).map(s => s.id);

  const totalOrders = filtered.length;
  const delivered = filtered.filter(o => deliveredStatusIds.includes(o.status_id)).length;
  const returned = filtered.filter(o => returnedStatusIds.includes(o.status_id)).length;

  const shippingOf = (o: any) => {
    if (deliveredStatusIds.includes(o.status_id)) return Number(o.delivery_price || 0);
    if (o.status_id === rejectPaidShipId || o.status_id === halfShipId) return Number(o.shipping_paid || 0);
    return 0;
  };
  const commissionOf = (o: any) =>
    commissionableIds.includes(o.status_id) ? Number(couriers[o.courier_id]?.commission_amount || 0) : 0;

  const totalShipping = filtered.reduce((s, o) => s + shippingOf(o), 0);
  const totalCommission = filtered.reduce((s, o) => s + commissionOf(o), 0);
  const netShipping = totalShipping - totalCommission;

  const rangeLabel = days.length === 0
    ? 'كل الأيام'
    : days.length === 1
      ? new Date(days[0]).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : `${days.length} أيام محددة`;

  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = filtered.map((o, i) => {
      const st = getStatus(o.status_id);
      return `<tr>
        <td>${i + 1}</td><td>${o.barcode || '-'}</td><td>${o.customer_name || '-'}</td>
        <td>${o.offices?.name || '-'}</td><td>${couriers[o.courier_id]?.full_name || '-'}</td>
        <td>${st?.name || '-'}</td><td>${shippingOf(o)} ج.م</td><td>${commissionOf(o)} ج.م</td>
      </tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>
      @page{size:A4;margin:10mm} body{font-family:'Segoe UI',sans-serif;font-size:12px}
      .header{text-align:center;font-size:22px;font-weight:bold;margin-bottom:5px}
      .sub{text-align:center;color:#666;margin-bottom:15px}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #333;padding:6px 8px;text-align:right;font-size:11px}
      th{background:#f0f0f0} .summary{margin-top:15px;font-size:14px;font-weight:bold;text-align:center;border:2px solid #000;padding:10px}
    </style></head><body>
      <div class="header">Super shipping services - التقرير اليومي</div>
      <div class="sub">${basis === 'collected' ? 'حسب تاريخ تحصيل المندوب' : 'حسب تاريخ إنشاء الأوردر'} — ${rangeLabel} | عدد الأوردرات: ${totalOrders}</div>
      <table><thead><tr><th>#</th><th>الباركود</th><th>العميل</th><th>المكتب</th><th>المندوب</th><th>الحالة</th><th>الشحن</th><th>عمولة المندوب</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="summary">تسليم: ${delivered} | مرتجع: ${returned} | إيراد الشحن: ${totalShipping.toLocaleString()} ج.م | عمولة المناديب: ${totalCommission.toLocaleString()} ج.م | صافي إيراد الشحن: ${netShipping.toLocaleString()} ج.م</div>
    </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">التقرير اليومي</h1>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">أساس التاريخ</Label>
            <Select value={basis} onValueChange={(v: any) => setBasis(v)}>
              <SelectTrigger className="w-48 h-9 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collected">تاريخ تحصيل المندوب</SelectItem>
                <SelectItem value="created">تاريخ إنشاء الأوردر</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">الأيام</Label>
            <MultiDateFilter dates={availableDays} value={days} onChange={setDays} placeholder="كل الأيام" triggerClassName="h-9 w-56" />
          </div>
          <Button size="sm" variant="outline" onClick={printReport}><Printer className="h-4 w-4 ml-1" />طباعة</Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-xs text-muted-foreground">إجمالي الأوردرات</p>
          <p className="text-xl font-bold">{totalOrders}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Package className="h-5 w-5 mx-auto mb-1 text-success" />
          <p className="text-xs text-muted-foreground">تسليم</p>
          <p className="text-xl font-bold text-success">{delivered}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Undo2 className="h-5 w-5 mx-auto mb-1 text-destructive" />
          <p className="text-xs text-muted-foreground">مرتجع</p>
          <p className="text-xl font-bold text-destructive">{returned}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Truck className="h-5 w-5 mx-auto mb-1 text-warning" />
          <p className="text-xs text-muted-foreground">إيراد الشحن</p>
          <p className="text-xl font-bold">{totalShipping.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">عمولة المناديب: {totalCommission.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="bg-primary/10 border-primary/30"><CardContent className="p-3 text-center">
          <Wallet className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-xs text-primary">صافي إيراد الشحن</p>
          <p className="text-xl font-bold text-primary">{netShipping.toLocaleString()}</p>
        </CardContent></Card>
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
                  <TableHead className="text-right hidden sm:table-cell">المكتب</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">عمولة المندوب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد أوردرات في الأيام المحددة</TableCell></TableRow>
                ) : filtered.map((o, i) => {
                  const st = getStatus(o.status_id);
                  return (
                    <TableRow key={o.id} className="border-border">
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                      <TableCell className="text-sm">{o.customer_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{o.offices?.name || '-'}</TableCell>
                      <TableCell className="text-sm">{couriers[o.courier_id]?.full_name || '-'}</TableCell>
                      <TableCell className="text-center">
                        {st ? <Badge style={{ backgroundColor: st.color + '30', color: st.color }} className="text-xs">{st.name}</Badge> : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{shippingOf(o)} ج.م</TableCell>
                      <TableCell className="text-sm text-sky-600">{commissionOf(o)} ج.م</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
