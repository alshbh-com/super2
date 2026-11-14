import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

type Notice = {
  id: string;
  title: string;
  body: string;
  kind: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) {
      toast.error('تعذر تحميل الإشعارات');
      return;
    }
    setNotices((data || []) as Notice[]);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
        const notice = payload.new as Notice;
        setNotices(current => [notice, ...current.filter(item => item.id !== notice.id)]);
        if (document.visibilityState === 'hidden' && Notification.permission === 'granted') {
          new Notification(notice.title, { body: notice.body });
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const markRead = async (notice: Notice) => {
    if (notice.is_read) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notice.id).eq('user_id', user?.id || '');
    if (error) {
      toast.error('تعذر تحديث الإشعار');
      return;
    }
    setNotices(current => current.map(item => item.id === notice.id ? { ...item, is_read: true } : item));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (error) {
      toast.error('تعذر تحديث الإشعارات');
      return;
    }
    setNotices(current => current.map(item => ({ ...item, is_read: true })));
  };

  const unread = notices.filter(notice => !notice.is_read).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2" aria-label={`الإشعارات${unread ? `، ${unread} غير مقروء` : ''}`}>
          <Bell className="h-4 w-4" />
          <span>الإشعارات</span>
          {unread > 0 && <Badge variant="destructive" className="min-w-5 justify-center px-1">{unread}</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-hidden bg-card border-border sm:max-w-lg" dir="rtl">
        <DialogHeader className="flex flex-row items-center justify-between gap-3">
          <DialogTitle>الإشعارات</DialogTitle>
          {unread > 0 && <Button variant="ghost" size="sm" onClick={markAllRead}><CheckCheck className="ml-1 h-4 w-4" />تحديد الكل كمقروء</Button>}
        </DialogHeader>
        <div className="max-h-[65vh] space-y-2 overflow-y-auto">
          {notices.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد إشعارات</p> : notices.map(notice => (
            <button key={notice.id} type="button" onClick={() => void markRead(notice)} className={`w-full rounded-md border p-3 text-right transition-colors ${notice.is_read ? 'border-border bg-card' : 'border-primary/40 bg-primary/10'}`}>
              <span className="flex items-center justify-between gap-2">
                <strong className="text-sm text-foreground">{notice.title}</strong>
                {!notice.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" aria-label="غير مقروء" />}
              </span>
              <span className="mt-1 block text-sm text-foreground">{notice.body}</span>
              <span className="mt-2 block text-xs text-muted-foreground">{new Date(notice.created_at).toLocaleString('ar-EG')}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}