import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';

const TYPES = ['عميل', 'تاجر', 'مندوب', 'مورد', 'مكتب', 'أخرى'];

export default function DataContacts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', type: 'عميل', notes: '' });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    setRows(data || []);
  };

  const resetForm = () => { setForm({ name: '', phone: '', address: '', type: 'عميل', notes: '' }); setEditId(null); };

  const save = async () => {
    if (!form.name.trim()) { toast.error('اكتب الاسم'); return; }
    if (editId) {
      const { error } = await supabase.from('contacts').update(form).eq('id', editId);
      if (error) { toast.error(error.message); return; }
      logActivity('تعديل بيانات في قسم داتا', { id: editId, name: form.name });
      toast.success('تم التعديل');
    } else {
      const { error } = await supabase.from('contacts').insert({ ...form, created_by: user?.id ?? null });
      if (error) { toast.error(error.message); return; }
      logActivity('إضافة بيانات في قسم داتا', { name: form.name, type: form.type });
      toast.success('تمت الإضافة');
    }
    setOpen(false); resetForm(); load();
  };

  const remove = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return;
    await supabase.from('contacts').delete().eq('id', id);
    toast.success('تم الحذف');
    load();
  };

  const edit = (r: any) => {
    setEditId(r.id);
    setForm({ name: r.name || '', phone: r.phone || '', address: r.address || '', type: r.type || 'عميل', notes: r.notes || '' });
    setOpen(true);
  };

  const filtered = useMemo(() => rows.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [r.name, r.phone, r.address, r.notes].some(v => (v || '').toString().toLowerCase().includes(q));
  }), [rows, search, typeFilter]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.type, (m.get(r.type) || 0) + 1));
    return m;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6 text-primary" />داتا</h1>
        <Button onClick={() => { resetForm(); setOpen(true); }}><Plus className="h-4 w-4 ml-2" />إضافة بيانات</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map(t => (
          <Badge key={t} variant={typeFilter === t ? 'default' : 'secondary'} className="cursor-pointer"
            onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}>
            {t} ({counts.get(t) || 0})
          </Badge>
        ))}
        {typeFilter !== 'all' && <Button size="sm" variant="ghost" onClick={() => setTypeFilter('all')}>عرض الكل</Button>}
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">بحث</Label>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="اسم / هاتف / عنوان" className="h-9 w-64 bg-secondary border-border" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">النوع</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-44 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground pb-2">النتائج: {filtered.length}</span>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                ) : filtered.map(r => (
                  <TableRow key={r.id} className="border-border">
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell dir="ltr">{r.phone || '-'}</TableCell>
                    <TableCell>{r.address || '-'}</TableCell>
                    <TableCell><Badge variant="secondary">{r.type}</Badge></TableCell>
                    <TableCell className="max-w-40 truncate">{r.notes || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => edit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editId ? 'تعديل بيانات' : 'إضافة بيانات'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label>الاسم *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border" /></div>
            <div className="space-y-2"><Label>رقم الهاتف</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="bg-secondary border-border" dir="ltr" /></div>
            <div className="space-y-2"><Label>العنوان</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="bg-secondary border-border" /></div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="bg-secondary border-border" /></div>
            <Button onClick={save} className="w-full">{editId ? 'حفظ التعديل' : 'إضافة'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
