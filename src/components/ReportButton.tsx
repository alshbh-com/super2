import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FileText, FileSpreadsheet, MessageCircle, Download, CheckSquare } from 'lucide-react';
import { exportReportPDF, exportReportExcel, openWhatsApp, buildWhatsAppSummary, type ReportColumn, type ReportMeta } from '@/lib/reportExport';

interface ReportButtonProps {
  meta: ReportMeta;
  columns: ReportColumn[];
  rows: any[];
  /** Currently selected subset of rows — when present and non-empty,
   *  the menu adds "تصدير المحدد فقط" options. */
  selectedRows?: any[];
  /** Optional phone to pre-fill WhatsApp (e.g. courier phone). */
  whatsappPhone?: string;
  /** Optional label override. */
  label?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'secondary';
  /** Hide whatsapp option (for non-courier reports). */
  hideWhatsapp?: boolean;
}

export function ReportButton({ meta, columns, rows, selectedRows, whatsappPhone, label = 'تصدير البيانات', size = 'sm', variant = 'outline', hideWhatsapp }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const hasSelection = !!(selectedRows && selectedRows.length > 0);

  const doPDF = (subset: any[], suffix?: string) => {
    const m = suffix ? { ...meta, title: meta.title + ' — ' + suffix } : meta;
    exportReportPDF(m, columns, subset);
    setOpen(false);
  };
  const doExcel = (subset: any[], suffix?: string) => {
    const m = suffix ? { ...meta, title: meta.title + ' — ' + suffix } : meta;
    exportReportExcel(m, columns, subset);
    setOpen(false);
  };
  const handleWhatsapp = () => {
    const msg = buildWhatsAppSummary(meta, rows.length);
    openWhatsApp(msg, whatsappPhone);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} className="gap-1">
          <Download className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {rows.length} سجل {meta.filtersText ? '(مفلتر)' : ''}
          {hasSelection && <span className="block text-primary">محدد: {selectedRows!.length}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] text-muted-foreground py-1">تصدير كل البيانات المعروضة</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => doPDF(rows)} className="cursor-pointer">
          <FileText className="h-4 w-4 ml-2 text-red-500" /> PDF (للطباعة)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => doExcel(rows)} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 ml-2 text-green-600" /> Excel
        </DropdownMenuItem>
        {hasSelection && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-primary py-1 flex items-center gap-1">
              <CheckSquare className="h-3 w-3" /> تصدير المحدد فقط ({selectedRows!.length})
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => doPDF(selectedRows!, 'المحدد')} className="cursor-pointer">
              <FileText className="h-4 w-4 ml-2 text-red-500" /> PDF (المحدد)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => doExcel(selectedRows!, 'المحدد')} className="cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 ml-2 text-green-600" /> Excel (المحدد)
            </DropdownMenuItem>
          </>
        )}
        {!hideWhatsapp && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleWhatsapp} className="cursor-pointer">
              <MessageCircle className="h-4 w-4 ml-2 text-green-500" />
              إرسال على واتساب
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
