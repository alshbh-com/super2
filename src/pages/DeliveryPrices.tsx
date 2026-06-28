import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const ALL = 'all';
const GLOBAL = 'global'; // sentinel meaning "applies to all offices without override"

export default function DeliveryPrices() {
  const [offices, setOffices] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [filterOffice, setFilterOffice] = useState(ALL);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string>(GLOBAL);
  const [governorate, setGovernorate] = useState('');
  const [price, setPrice] = useState('');
  const [pickupPrice, setPickupPrice] = useState('');
  const [returnComp, setReturnComp] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('offices').select('id, name').order('name').then(({ data }) => setOffices(data || []));
    load();
  }, []);

  const load = async () => {
    const { data } = await supabase.from('delivery_prices').select('*, offices(name)').order('governorate');
    setPrices(data || []);
  };

  const save = async () => {
    if (!governorate.trim()) { toast.error('المحافظة مطلوبة'); return; }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) { toast.error('السعر مطلوب'); return; }
    const pp = parseFloat(pickupPrice) || 0;
    const rc = parseFloat(returnComp) || 0;
    const payload: any = {
      office_id: officeId === GLOBAL ? null : officeId,
      governorate: governorate.trim(),
      price: p,
      pickup_price: pp,
      return_compensation: rc,
    };
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from('delivery_prices').update(payload).eq('id', editId);
        if (error) throw error;
        toast.success('تم التعديل');
      } else {
        const { error } = await supabase.from('delivery_prices').insert(payload);
        if (error) throw error;
        toast.success('تم الإضافة');
      }
      setOpen(false); resetForm(); load();
    } catch (e: any) {
      toast.error(e.message || 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from('delivery_prices').delete().eq('id', id);
    toast.success('تم الحذف'); load();
  };

  const edit = (item: any) => {
    setEditId(item.id);
    setOfficeId(item.office_id || GLOBAL);
    setGovernorate(item.governorate);
    setPrice(String(item.price ?? ''));
    setPickupPrice(String(item.pickup_price ?? ''));
    setReturnComp(String(item.return_compensation ?? 0));
    setOpen(true);
  };

  const resetForm = () => {
    setEditId(null); setOfficeId(GLOBAL); setGovernorate('');
    setPrice(''); setPickupPrice(''); setReturnComp('');
  };

  const filtered = filterOffice === ALL
    ? prices
    : filterOffice === GLOBAL
      ? prices.filter(p => !p.office_id)
      : prices.filter(p => p.office_id === filterOffice);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">أسعار التوصيل</h1>
          <p className="text-xs text-muted-foreground mt-1">
            السعر العام بدون اختيار مكتب ينطبق على كل المكاتب اللي ماحدّدتلهاش سعر خاص.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-2" />إضافة سعر</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editId ? 'تعديل سعر' : 'إضافة سعر توصيل'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>المكتب (اتركه عام للتطبيق على الكل)</Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL}>🌐 سعر عام (كل المكاتب)</SelectItem>
                    {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المحافظة / المنطقة *</Label>
                <Input value={governorate} onChange={e => setGovernorate(e.target.value)} className="bg-secondary border-border" placeholder="مثال: القاهرة" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>سعر الشحن (ج.م) *</Label>
                  <Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-secondary border-border" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>البيك اب (ج.م)</Label>
                  <Input type="number" value={pickupPrice} onChange={e => setPickupPrice(e.target.value)} className="bg-secondary border-border" placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>تعويض شحن المرتجع (ج.م)</Label>
                <Input type="number" value={returnComp} onChange={e => setReturnComp(e.target.value)} className="bg-secondary border-border" placeholder="0" />
                <p className="text-[10px] text-muted-foreground">يُخصم من التاجر بدل سعر الشحن الكامل لما العميل ما يدفعش الشحن.</p>
              </div>
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? 'جاري الحفظ...' : (editId ? 'حفظ التعديل' : 'إضافة')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Select value={filterOffice} onValueChange={setFilterOffice}>
        <SelectTrigger className="w-56 bg-secondary border-border"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>كل المكاتب + العام</SelectItem>
          <SelectItem value={GLOBAL}>🌐 سعر عام فقط</SelectItem>
          {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">المكتب</TableHead>
                <TableHead className="text-right">المحافظة</TableHead>
                <TableHead className="text-right">سعر الشحن</TableHead>
                <TableHead className="text-right">البيك اب</TableHead>
                <TableHead className="text-right">تعويض المرتجع</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد أسعار</TableCell></TableRow>
              ) : filtered.map(item => (
                <TableRow key={item.id} className="border-border">
                  <TableCell className="font-medium">
                    {item.office_id ? (item.offices?.name || '-') : <Badge variant="secondary">🌐 عام</Badge>}
                  </TableCell>
                  <TableCell>{item.governorate}</TableCell>
                  <TableCell className="font-bold">{item.price} ج.م</TableCell>
                  <TableCell>{item.pickup_price || 0} ج.م</TableCell>
                  <TableCell className="text-amber-600">{item.return_compensation || 0} ج.م</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => edit(item)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></Button>
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
