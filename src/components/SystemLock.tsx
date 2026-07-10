import { Lock, MessageCircle } from "lucide-react";

export default function SystemLock() {
  const phone = "01061067966";
  const waLink = `https://wa.me/2${phone}`;
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">السيستم مقفل</h1>
        <p className="text-muted-foreground leading-relaxed">
          تم إيقاف الوصول إلى السيستم مؤقتاً.
          <br />
          للتفعيل وإعادة الفتح يرجى التواصل عبر واتساب:
        </p>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          <MessageCircle className="h-5 w-5" />
          واتساب: {phone}
        </a>
        <p className="text-xs text-muted-foreground">Super shipping services</p>
      </div>
    </div>
  );
}
