import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Package, CheckCircle2, Truck, Boxes } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/SearchableSelect';

const DELIVERED = ['تم التسليم', 'تسليم جزئي', 'استلم ودفع نص الشحن'];
const CLOSED_OUT = ['مرتجع', 'ملغي', 'مرتجع لم يدفع شحن', 'رفض ودفع شحن', 'رفض دفع شحن'];

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [officeId, setOfficeId] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [filterOffice, setFilterOffice] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [{ data: prods }, { data: offs }, { data: ords }] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('offices').select('id, name').order('name'),
      supabase.from('orders').select('id, office_id, quantity, is_closed, order_statuses(name)').limit(10000),
    ]);
    setProducts(prods || []);
    setOffices(offs || []);
    setOrders(ords || []);
  };

  const officeName = (id: string | null) => offices.find(o => o.id === id)?.name || '—';

  const save = async () => {
    if (!name.trim()) return toast.error('اكتب اسم المنتج');
    const payload: any = { name, quantity: Number(quantity), office_id: officeId || null };
    if (editId) {
      await supabase.from('products').update(payload).eq('id', editId);
      toast.success('تم التعديل');
    } else {
      await supabase.from('products').insert(payload);
      toast.success('تم الإضافة');
    }
    setOpen(false); setName(''); setQuantity('0'); setOfficeId(''); setEditId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from('products').delete().eq('id', id);
    toast.success('تم الحذف');
    load();
  };

  const visible = useMemo(
    () => filterOffice ? products.filter(p => p.office_id === filterOffice) : products,
    [products, filterOffice]
  );

  const stats = useMemo(() => {
    const rows = filterOffice ? orders.filter(o => o.office_id === filterOffice) : orders;
    let delivered = 0, inTransit = 0;
    rows.forEach(o => {
      const st = (o.order_statuses as any)?.name || '';
      const qty = Number(o.quantity || 1);
      if (DELIVERED.includes(st)) delivered += qty;
      else if (!CLOSED_OUT.includes(st) && !o.is_closed) inTransit += qty;
    });
    const total = visible.reduce((s, p) => s + Number(p.quantity || 0), 0);
    return { delivered, inTransit, total, available: total - (delivered + inTransit) };
  }, [orders, visible, filterOffice]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">المنتجات والمخزون</h1>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">بحث بالتاجر</Label>
            <SearchableSelect
              options={[{ value: '', label: 'كل التجار' }, ...offices.map(o => ({ value: o.id, label: o.name }))]}
              value={filterOffice}
              onChange={setFilterOffice}
              placeholder="كل التجار"
            />
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setName(''); setQuantity('0'); setOfficeId(''); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-2" />إضافة منتج</Button></DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>{editId ? 'تعديل منتج' : 'إضافة منتج'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>اسم التاجر</Label>
                  <SearchableSelect
                    options={offices.map(o => ({ value: o.id, label: o.name }))}
                    value={officeId}
                    onChange={setOfficeId}
                    placeholder="اختر التاجر"
                    triggerClassName="w-full"
                  />
                </div>
                <div><Label>اسم المنتج</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary border-border" /></div>
                <div><Label>عدد القطع</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="bg-secondary border-border" /></div>
                <Button onClick={save} className="w-full">{editId ? 'حفظ' : 'إضافة'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <div className="text-xs text-muted-foreground">منفذ</div>
              <div className="text-2xl font-bold text-foreground">{stats.delivered}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Truck className="h-8 w-8 text-amber-600" />
            <div>
              <div className="text-xs text-muted-foreground">قيد التوصيل</div>
              <div className="text-2xl font-bold text-foreground">{stats.inTransit}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Boxes className="h-8 w-8 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">متاح بالمخزن (إجمالي {stats.total})</div>
              <div className="text-2xl font-bold text-foreground">{stats.available}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">التاجر</TableHead>
                <TableHead className="text-right">المنتج</TableHead>
                <TableHead className="text-right">المخزون</TableHead>
                <TableHead className="text-right">تاريخ الاستلام</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد منتجات</TableCell></TableRow>
              ) : visible.map((p) => (
                <TableRow key={p.id} className="border-border">
                  <TableCell className="text-sm">{officeName(p.office_id)}</TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" />{p.name}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.quantity > 0 ? 'default' : 'destructive'}>{p.quantity} قطعة</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString('ar-EG') : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(p.id); setName(p.name); setQuantity(String(p.quantity)); setOfficeId(p.office_id || ''); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
