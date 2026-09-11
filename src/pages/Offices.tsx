import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';

export default function Offices() {
  const [offices, setOffices] = useState<any[]>([]);
  const [officeStats, setOfficeStats] = useState<Record<string, { total: number; last: string | null }>>({});
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', specialty: '', owner_name: '', owner_phone: '', address: '', notes: '', office_commission: '', return_shipping_compensation: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('offices').select('*').order('created_at', { ascending: false });
    setOffices(data || []);
    const { data: ords } = await supabase.from('orders').select('office_id, created_at').limit(5000);
    const map: Record<string, { total: number; last: string | null }> = {};
    (ords || []).forEach((o: any) => {
      if (!o.office_id) return;
      const cur = map[o.office_id] || { total: 0, last: null };
      cur.total++;
      if (!cur.last || o.created_at > cur.last) cur.last = o.created_at;
      map[o.office_id] = cur;
    });
    setOfficeStats(map);
  };

  const isActive = (id: string) => {
    const last = officeStats[id]?.last;
    if (!last) return false;
    return (Date.now() - new Date(last).getTime()) / 86400000 <= 15;
  };

  const sortedOffices = [...offices].sort((a, b) => {
    const act = Number(isActive(b.id)) - Number(isActive(a.id));
    if (act !== 0) return act;
    return (officeStats[b.id]?.total || 0) - (officeStats[a.id]?.total || 0);
  });

  const activeCount = offices.filter(o => isActive(o.id)).length;


  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  const resetForm = () => setForm({ name: '', specialty: '', owner_name: '', owner_phone: '', address: '', notes: '', office_commission: '', return_shipping_compensation: '' });

  const save = async () => {
    if (!form.name.trim()) return;
    const payload: any = {
      name: form.name,
      specialty: form.specialty,
      owner_name: form.owner_name,
      owner_phone: form.owner_phone,
      address: form.address,
      notes: form.notes,
      office_commission: Number(form.office_commission) || 0,
      return_shipping_compensation: Number(form.return_shipping_compensation) || 0,
    };
    if (editId) {
      await supabase.from('offices').update(payload).eq('id', editId);
      logActivity('تعديل مكتب', { office_id: editId, name: form.name });
      toast.success('تم التعديل');
    } else {
      await supabase.from('offices').insert(payload);
      logActivity('إضافة مكتب', { name: form.name });
      toast.success('تم الإضافة');
    }
    setOpen(false); resetForm(); setEditId(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    await supabase.from('offices').delete().eq('id', id);
    logActivity('حذف مكتب', { office_id: id });
    toast.success('تم الحذف'); load();
  };

  const edit = (o: any) => {
    setEditId(o.id);
    setForm({ name: o.name || '', specialty: o.specialty || '', owner_name: o.owner_name || '', owner_phone: o.owner_phone || '', address: o.address || '', notes: o.notes || '', office_commission: String(o.office_commission ?? ''), return_shipping_compensation: String(o.return_shipping_compensation ?? '') });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">المكاتب</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 ml-2" />إضافة مكتب</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader><DialogTitle>{editId ? 'تعديل مكتب' : 'إضافة مكتب'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>اسم المكتب *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label>التخصص</Label><Input value={form.specialty} onChange={e => set('specialty', e.target.value)} className="bg-secondary border-border" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>اسم صاحب المكتب</Label><Input value={form.owner_name} onChange={e => set('owner_name', e.target.value)} className="bg-secondary border-border" /></div>
                <div className="space-y-2"><Label>رقم الهاتف</Label><Input value={form.owner_phone} onChange={e => set('owner_phone', e.target.value)} className="bg-secondary border-border" dir="ltr" /></div>
              </div>
              <div className="space-y-2"><Label>العنوان</Label><Input value={form.address} onChange={e => set('address', e.target.value)} className="bg-secondary border-border" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>عمولة المكتب لكل أوردر مُسلَّم (ج.م)</Label><Input type="number" value={form.office_commission} onChange={e => set('office_commission', e.target.value)} className="bg-secondary border-border" placeholder="مثال: 70" dir="ltr" /></div>
                <div className="space-y-2">
                  <Label>تعويض الشحن في حالة الرفض (ج.م)</Label>
                  <Input type="number" value={form.return_shipping_compensation} onChange={e => set('return_shipping_compensation', e.target.value)} className="bg-secondary border-border" placeholder="مثال: 20" dir="ltr" />
                  <p className="text-[10px] text-muted-foreground">يُخصم من تحصيل التاجر بدلاً من الشحن الكامل عند حالة "رفض دفع شحن"</p>
                </div>
              </div>
              <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="bg-secondary border-border" rows={2} /></div>
              <Button onClick={save} className="w-full">{editId ? 'حفظ التعديل' : 'إضافة'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <p className="text-xs text-muted-foreground">إجمالي التجار</p>
          <p className="text-2xl font-bold">{offices.length}</p>
        </CardContent></Card>
        <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-3 text-center">
          <p className="text-xs text-emerald-700">نشط</p>
          <p className="text-2xl font-bold text-emerald-700">{activeCount}</p>
        </CardContent></Card>
        <Card className="bg-slate-50 border-slate-200"><CardContent className="p-3 text-center">
          <p className="text-xs text-slate-600">خامل (15 يوم بدون أوردرات)</p>
          <p className="text-2xl font-bold text-slate-600">{offices.length - activeCount}</p>
        </CardContent></Card>
        <Card className="bg-amber-50 border-amber-200"><CardContent className="p-3 text-center">
          <p className="text-xs text-amber-700">إجمالي الأوردرات</p>
          <p className="text-2xl font-bold text-amber-700">{Object.values(officeStats).reduce((s, v) => s + v.total, 0)}</p>
        </CardContent></Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">اسم المكتب</TableHead>
                  <TableHead className="text-right">حالة التاجر</TableHead>
                  <TableHead className="text-right">أوردرات</TableHead>
                  <TableHead className="text-right">صاحب المكتب</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">التخصص</TableHead>
                   <TableHead className="text-right">العنوان</TableHead>
                   <TableHead className="text-right">إضافة أوردرات</TableHead>
                   <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOffices.map((o) => (
                  <TableRow key={o.id} className="border-border">
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell>
                      <Badge className={isActive(o.id) ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white'}>
                        {isActive(o.id) ? 'نشط' : 'خامل'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">{officeStats[o.id]?.total || 0}</TableCell>
                    <TableCell>{o.owner_name || '-'}</TableCell>
                    <TableCell dir="ltr">{o.owner_phone || '-'}</TableCell>
                    <TableCell>{o.specialty || '-'}</TableCell>
                    <TableCell>{o.address || '-'}</TableCell>

                    <TableCell>
                      <Switch
                        checked={o.can_add_orders || false}
                        onCheckedChange={async (checked) => {
                          await supabase.from('offices').update({ can_add_orders: checked }).eq('id', o.id);
                          load();
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => edit(o)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(o.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
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
