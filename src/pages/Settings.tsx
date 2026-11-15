import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Lock, BellRing, Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { applyAppTheme, getSavedAppTheme, type AppTheme } from '@/lib/theme';

export default function Settings() {
  const { isOwner } = useAuth();
  const [statuses, setStatuses] = useState<any[]>([]);

  // User creation
  const [userOpen, setUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserCode, setNewUserCode] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('courier');
  const [creatingUser, setCreatingUser] = useState(false);

  // Accounting password
  const [accountingPassword, setAccountingPassword] = useState('');
  const [currentAccountingPassword, setCurrentAccountingPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(getSavedAppTheme);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [stockThreshold, setStockThreshold] = useState('5');

  useEffect(() => {
    loadStatuses();
    loadAccountingPassword();
    void supabase.from('app_settings').select('value').eq('key', 'low_stock_threshold').maybeSingle().then(({ data }) => {
      if (data?.value) setStockThreshold(data.value);
    });
  }, []);

  useEffect(() => {
    const syncTheme = (event: Event) => setTheme((event as CustomEvent<AppTheme>).detail);
    window.addEventListener('app-theme-change', syncTheme);
    return () => window.removeEventListener('app-theme-change', syncTheme);
  }, []);

  const enableDeviceNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      toast.error('هذا المتصفح لا يدعم إشعارات الجهاز');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') toast.success('تم تفعيل إشعارات الجهاز');
    else toast.error('لم يتم السماح بإشعارات الجهاز');
  };

  const saveStockThreshold = async () => {
    const value = Math.max(0, Math.floor(Number(stockThreshold) || 0));
    const { error } = await supabase.from('app_settings').upsert({ key: 'low_stock_threshold', value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) toast.error('تعذر حفظ حد انخفاض المخزون');
    else { setStockThreshold(String(value)); toast.success('تم حفظ حد التنبيه'); }
  };

  const loadStatuses = async () => {
    const { data } = await supabase.from('order_statuses').select('*').order('sort_order');
    setStatuses(data || []);
  };

  const loadAccountingPassword = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'accounting_password')
      .maybeSingle();
    if (data?.value) {
      setCurrentAccountingPassword(data.value);
      setAccountingPassword(data.value);
    }
  };

  const saveAccountingPassword = async () => {
    setSavingPassword(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'accounting_password', value: accountingPassword, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSavingPassword(false);
    if (error) {
      toast.error('فشل حفظ كلمة المرور');
      return;
    }
    setCurrentAccountingPassword(accountingPassword);
    // Clear session so password is required again
    sessionStorage.removeItem('accounting_verified');
    toast.success(accountingPassword ? 'تم حفظ كلمة مرور سيستم الحسابات' : 'تم إزالة كلمة المرور');
  };

  const createUser = async () => {
    if (!newUserName || !newUserCode) return;
    setCreatingUser(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/auth-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: 'create-user',
          userData: { full_name: newUserName, phone: newUserPhone, login_code: newUserCode, role: newUserRole }
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('تم إنشاء المستخدم بنجاح');
      setUserOpen(false); setNewUserName(''); setNewUserPhone(''); setNewUserCode(''); setNewUserRole('courier');
    } catch (err: any) {
      toast.error(err.message || 'خطأ في إنشاء المستخدم');
    }
    setCreatingUser(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />المظهر والإشعارات</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 space-y-1">
              <Label>ثيم التطبيق</Label>
              <Select value={theme} onValueChange={(value: AppTheme) => { setTheme(value); applyAppTheme(value); }}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">فاتح — برتقالي</SelectItem>
                  <SelectItem value="high-contrast">فاتح عالي التباين</SelectItem>
                  <SelectItem value="dark">داكن</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={enableDeviceNotifications} disabled={notificationPermission === 'granted'}>
              <BellRing className="ml-2 h-4 w-4" />
              {notificationPermission === 'granted' ? 'إشعارات الجهاز مفعّلة' : 'تفعيل إشعارات الجهاز'}
            </Button>
            {notificationPermission === 'unsupported' && <span className="text-xs text-muted-foreground">المتصفح لا يدعم إشعارات الجهاز</span>}
          </div>
          {isOwner && <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div className="space-y-1"><Label>إشعار انخفاض المخزون عند (قطع)</Label><Input type="number" min={0} value={stockThreshold} onChange={event => setStockThreshold(event.target.value)} className="w-40 bg-secondary border-border" /></div>
            <Button variant="outline" onClick={saveStockThreshold}>حفظ حد التنبيه</Button>
          </div>}
        </CardContent>
      </Card>

      {/* Accounting Password - Owner only */}
      {isOwner && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              كلمة مرور سيستم الحسابات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">حدد كلمة مرور للدخول إلى سيستم الحسابات. اتركها فارغة لإلغاء الحماية.</p>
            <div className="flex gap-2 items-end max-w-sm">
              <div className="flex-1 space-y-1">
                <Label>كلمة المرور</Label>
                <Input
                  type="text"
                  value={accountingPassword}
                  onChange={(e) => setAccountingPassword(e.target.value)}
                  className="bg-secondary border-border"
                  placeholder="أدخل كلمة المرور..."
                  dir="ltr"
                />
              </div>
              <Button onClick={saveAccountingPassword} disabled={savingPassword}>
                {savingPassword ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </div>
            {currentAccountingPassword && (
              <p className="text-xs text-muted-foreground">كلمة المرور الحالية مفعّلة ✅</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Order Statuses */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>حالات الأوردر</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">اللون</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((s) => (
                <TableRow key={s.id} className="border-border">
                  <TableCell><Badge style={{ backgroundColor: s.color }}>{s.name}</Badge></TableCell>
                  <TableCell><div className="h-5 w-5 rounded" style={{ backgroundColor: s.color }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Management - Owner only */}
      {isOwner && (
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>إدارة المستخدمين</CardTitle>
            <Dialog open={userOpen} onOpenChange={setUserOpen}>
              <DialogTrigger asChild><Button size="sm"><UserPlus className="h-4 w-4 ml-1" />إضافة مستخدم</Button></DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>الاسم</Label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="bg-secondary border-border" /></div>
                  <div><Label>الهاتف</Label><Input value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} className="bg-secondary border-border" dir="ltr" /></div>
                  <div><Label>كود الدخول (كلمة المرور)</Label><Input value={newUserCode} onChange={(e) => setNewUserCode(e.target.value)} className="bg-secondary border-border" dir="ltr" /></div>
                  <div>
                    <Label>الصلاحية</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">مسؤول (Admin)</SelectItem>
                        <SelectItem value="courier">مندوب (Courier)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createUser} className="w-full" disabled={creatingUser}>
                    {creatingUser ? 'جارٍ الإنشاء...' : 'إنشاء المستخدم'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
