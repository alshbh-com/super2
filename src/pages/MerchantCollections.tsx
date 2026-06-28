import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ReportButton } from '@/components/ReportButton';
import { SearchableSelect } from '@/components/SearchableSelect';
import { MultiDateFilter } from '@/components/MultiDateFilter';
import { MultiSearchableSelect } from '@/components/MultiSearchableSelect';
import { computeOrderTotal, computeCollectedFromCustomer, isRefusalStatus, isDeliveredStatus } from '@/lib/orderCalc';

export default function MerchantCollections() {
  const [offices, setOffices] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]); // delivery_prices (office_id + governorate)
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from('offices').select('id, name, office_commission, return_shipping_compensation').order('name').then(({ data }) => setOffices(data || []));
    supabase.from('delivery_prices').select('office_id, governorate, price, return_compensation').then(({ data }) => setPrices(data || []));
  }, []);

  useEffect(() => {
    (async () => {
      let q = supabase.from('orders')
        .select('id, barcode, customer_code, customer_name, customer_phone, address, governorate, price, delivery_price, partial_amount, shipping_paid, office_id, sender_collected_at, status_id, order_statuses(name, color)')
        .not('sender_collected_at', 'is', null)
        .order('sender_collected_at', { ascending: false });
      if (selectedOffices.length === 1) q = q.eq('office_id', selectedOffices[0]);
      else if (selectedOffices.length > 1) q = q.in('office_id', selectedOffices);
      const { data } = await q;
      setOrders(data || []);
      setSelectedDates([]);
      setSelected(new Set());
    })();
  }, [selectedOffices]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.sender_collected_at) set.add(String(o.sender_collected_at).slice(0, 10)); });
    return Array.from(set).sort().reverse();
  }, [orders]);

  const filtered = useMemo(() => selectedDates.length === 0
    ? orders
    : orders.filter(o => selectedDates.includes(String(o.sender_collected_at).slice(0, 10))),
    [orders, selectedDates]);

  const getOffice = (id: string) => offices.find(o => o.id === id);
  const getOfficeName = (id: string) => getOffice(id)?.name || '-';

  /** Lookup the company commission for an order: office-specific governorate price > global governorate price > office.office_commission default. */
  const commissionFor = (o: any): number => {
    const gov = o.governorate || '';
    const officeSpecific = prices.find(p => p.office_id === o.office_id && p.governorate === gov);
    if (officeSpecific) return Number(officeSpecific.price || 0);
    const global = prices.find(p => !p.office_id && p.governorate === gov);
    if (global) return Number(global.price || 0);
    return Number(getOffice(o.office_id)?.office_commission || 0);
  };

  /** Refund-shipping deduction: per-governorate return_compensation, else office's default, else 0. */
  const returnCompFor = (o: any): number => {
    const gov = o.governorate || '';
    const officeSpecific = prices.find(p => p.office_id === o.office_id && p.governorate === gov);
    if (officeSpecific && officeSpecific.return_compensation != null) return Number(officeSpecific.return_compensation || 0);
    const global = prices.find(p => !p.office_id && p.governorate === gov);
    if (global && global.return_compensation != null) return Number(global.return_compensation || 0);
    return Number(getOffice(o.office_id)?.return_shipping_compensation || 0);
  };

  /** Per-row computation. */
  const computeRow = (o: any) => {
    const statusName = (o.order_statuses as any)?.name;
    const gross = computeCollectedFromCustomer(o, statusName); // money collected from customer for THIS order
    const refusal = isRefusalStatus(statusName);
    const delivered = isDeliveredStatus(statusName);
    // Company deduction per order: full commission on delivered; only return-compensation on refusal; nothing otherwise.
    const companyCut = delivered ? commissionFor(o) : refusal ? returnCompFor(o) : 0;
    const net = gross - companyCut;
    return { gross, companyCut, net, statusName };
  };

  const rowsWithCalc = useMemo(() => filtered.map(o => ({ o, ...computeRow(o) })), [filtered, prices, offices]);

  const totalGross = rowsWithCalc.reduce((s, r) => s + r.gross, 0);
  const totalCut = rowsWithCalc.reduce((s, r) => s + r.companyCut, 0);
  const totalNet = totalGross - totalCut;
  const deliveredCount = rowsWithCalc.filter(r => isDeliveredStatus(r.statusName)).length;

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(o => o.id)));
  const selectedRows = filtered.filter(o => selected.has(o.id));

  const officeOptions = offices.map(o => ({ value: o.id, label: o.name }));

  const filtersText = [
    selectedOffices.length ? `التجار: ${selectedOffices.map(getOfficeName).join('، ')}` : null,
    selectedDates.length ? `التواريخ: ${selectedDates.join('، ')}` : null,
  ].filter(Boolean).join(' | ');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">تحصيلات التاجر</h1>
        <ReportButton
          meta={{
            title: 'تحصيلات التاجر',
            filtersText,
            summary: [
              { label: 'عدد الأوردرات', value: filtered.length },
              { label: 'تم التسليم', value: deliveredCount },
              { label: 'إجمالي المحصَّل', value: `${totalGross} ج.م` },
              { label: 'عمولة الشركة', value: `${totalCut} ج.م` },
              { label: 'صافي التاجر', value: `${totalNet} ج.م` },
            ],
          }}
          columns={[
            { key: 'barcode', label: 'الباركود' },
            { key: 'customer_code', label: 'كود الراسل' },
            { key: 'customer_name', label: 'العميل' },
            { key: 'customer_phone', label: 'الهاتف' },
            { key: 'address', label: 'العنوان' },
            { key: 'governorate', label: 'المحافظة' },
            { key: 'office_id', label: 'التاجر', format: (v) => getOfficeName(v) },
            { key: 'price', label: 'السعر' },
            { key: 'delivery_price', label: 'الشحن' },
            { key: 'total', label: 'الإجمالي', format: (_: any, r: any) => computeOrderTotal(r) },
            { key: 'gross', label: 'المحصَّل', format: (_: any, r: any) => computeRow(r).gross },
            { key: 'commission', label: 'عمولة الشركة', format: (_: any, r: any) => computeRow(r).companyCut },
            { key: 'net', label: 'الصافي للتاجر', format: (_: any, r: any) => computeRow(r).net },
            { key: 'order_statuses', label: 'الحالة', format: (v: any) => v?.name || '-' },
            { key: 'sender_collected_at', label: 'تاريخ التحصيل' },
          ]}
          rows={filtered}
          selectedRows={selectedRows}
          hideWhatsapp
        />
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">التاجر / المكتب (متعدد)</Label>
          <MultiSearchableSelect options={officeOptions} value={selectedOffices} onChange={setSelectedOffices} placeholder="كل التجار" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">تاريخ التحصيل (متعدد)</Label>
          <MultiDateFilter dates={availableDates} value={selectedDates} onChange={setSelectedDates} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">عدد الأوردرات</p><p className="text-lg font-bold">{filtered.length}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">تم التسليم</p><p className="text-lg font-bold text-emerald-500">{deliveredCount}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">إجمالي المحصَّل</p><p className="text-lg font-bold text-emerald-500">{totalGross} ج.م</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">عمولة الشركة</p><p className="text-lg font-bold text-amber-500">{totalCut} ج.م</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">صافي التاجر</p><p className="text-lg font-bold text-primary">{totalNet} ج.م</p></CardContent></Card>
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
                  <TableHead className="text-right">المحافظة</TableHead>
                  <TableHead className="text-right">التاجر</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">الإجمالي</TableHead>
                  <TableHead className="text-right">المحصَّل</TableHead>
                  <TableHead className="text-right">عمولة الشركة</TableHead>
                  <TableHead className="text-right">الصافي</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ التحصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={16} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                ) : rowsWithCalc.map(({ o, gross, companyCut, net, statusName }) => (
                  <TableRow key={o.id} className="border-border">
                    <TableCell><Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                    <TableCell className="text-xs">{o.customer_code || '-'}</TableCell>
                    <TableCell className="text-sm">{o.customer_name}</TableCell>
                    <TableCell dir="ltr" className="text-sm">{o.customer_phone}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={o.address}>{o.address || '-'}</TableCell>
                    <TableCell className="text-xs">{o.governorate || '-'}</TableCell>
                    <TableCell className="text-sm">{getOfficeName(o.office_id)}</TableCell>
                    <TableCell className="text-sm">{o.price} ج.م</TableCell>
                    <TableCell className="text-sm">{o.delivery_price} ج.م</TableCell>
                    <TableCell className="text-sm font-bold">{computeOrderTotal(o)} ج.م</TableCell>
                    <TableCell className="text-sm font-bold text-emerald-600">{gross} ج.م</TableCell>
                    <TableCell className="text-sm text-amber-600">{companyCut} ج.م</TableCell>
                    <TableCell className="text-sm font-bold text-primary">{net} ج.م</TableCell>
                    <TableCell className="text-xs">{statusName || '-'}</TableCell>
                    <TableCell className="text-xs">{new Date(o.sender_collected_at).toLocaleString('ar-EG')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {filtered.length > 0 && (
                <TableFooter>
                  <TableRow className="border-border bg-muted/50">
                    <TableCell colSpan={11} className="font-bold">الإجمالي ({filtered.length})</TableCell>
                    <TableCell className="font-bold text-emerald-600">{totalGross} ج.م</TableCell>
                    <TableCell className="font-bold text-amber-600">{totalCut} ج.م</TableCell>
                    <TableCell className="font-bold text-primary">{totalNet} ج.م</TableCell>
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
