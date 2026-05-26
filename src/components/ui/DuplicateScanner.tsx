import * as React from "react";
import {
  AlertCircle, CheckCircle2, Trash2, ScanSearch,
  Calendar, DollarSign, User, FileText
} from "lucide-react";
import toast from "react-hot-toast";
import { deleteDocument } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import Modal from "./Modal";
import { formatCurrency } from "../../utils/formatters";

export interface DuplicateConfig {
  collection: string;
  labelEn: string;
  labelAr: string;
  /** Fields used to generate duplicate key — e.g. ["amount","date","description"] */
  keyFields: string[];
  /** How to display each record in the UI */
  renderRow?: (item: any, language: "ar" | "en") => React.ReactNode;
}

interface DuplicateGroup {
  key: string;
  items: any[];
}

interface DuplicateScannerProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  config: DuplicateConfig;
}

export const DuplicateScanner: React.FC<DuplicateScannerProps> = ({
  isOpen, onClose, data, config
}) => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [groups, setGroups] = React.useState<DuplicateGroup[]>([]);
  const [ignored, setIgnored] = React.useState<Set<string>>(new Set());
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const map: Record<string, any[]> = {};
    data.forEach(item => {
      const key = config.keyFields.map(f => {
        const v = item[f];
        if (v == null) return "";
        if (typeof v === "number") return v.toFixed(2);
        return String(v).toLowerCase().trim();
      }).join("|");
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    const dupes = Object.entries(map)
      .filter(([key, items]) => items.length > 1 && !ignored.has(key))
      .map(([key, items]) => ({ key, items }));
    setGroups(dupes);
  }, [isOpen, data, ignored, config.keyFields]);

  const handleDelete = async (id: string) => {
    if (!currentCompany) return;
    if (!window.confirm(language === "ar" ? "هل أنت متأكد من حذف هذا السجل؟" : "Delete this record?")) return;
    setDeleting(id);
    try {
      await deleteDocument(`companies/${currentCompany.id}/${config.collection}`, id);
      toast.success(language === "ar" ? "تم الحذف" : "Record deleted");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleKeep = (key: string) => {
    setIgnored(prev => new Set([...prev, key]));
    toast.success(language === "ar" ? "تم تجاهل هذه المجموعة" : "Group marked as reviewed");
  };

  const defaultRender = (item: any) => (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-3 text-xs">
        {item.description && <span className="font-semibold text-slate-700 truncate max-w-[160px]">{item.description}</span>}
        {item.name && <span className="font-semibold text-slate-700 truncate max-w-[160px]">{item.name}</span>}
        {item.customerName && <span className="flex items-center gap-1 text-slate-500"><User className="h-3 w-3" />{item.customerName}</span>}
        {item.supplierName && <span className="flex items-center gap-1 text-slate-500"><User className="h-3 w-3" />{item.supplierName}</span>}
        {(item.totalAmount || item.grandTotal || item.amount) && (
          <span className="flex items-center gap-1 font-bold text-slate-800">
            <DollarSign className="h-3 w-3 text-emerald-500" />
            {formatCurrency(item.totalAmount || item.grandTotal || item.amount, language)}
          </span>
        )}
        {(item.date || item.issueDate) && (
          <span className="flex items-center gap-1 text-slate-400">
            <Calendar className="h-3 w-3" />
            {item.date || item.issueDate}
          </span>
        )}
        {(item.invoiceNumber || item.billNumber || item.quotationNumber) && (
          <span className="flex items-center gap-1 text-brand-primary font-mono text-[10px]">
            <FileText className="h-3 w-3" />
            {item.invoiceNumber || item.billNumber || item.quotationNumber}
          </span>
        )}
      </div>
      <div className="flex gap-2 text-[10px] text-slate-400">
        <span>ID: {item.id?.slice(0, 12)}…</span>
        {item.status && <span className="capitalize">{item.status}</span>}
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={`${language === "ar" ? "فحص التكرار" : "Duplicate Scanner"} — ${language === "ar" ? config.labelAr : config.labelEn}`}
      size="xl">
      <div className="space-y-4">
        {/* Header banner */}
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${groups.length > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <div className={`p-2 rounded-lg ${groups.length > 0 ? "bg-amber-100" : "bg-emerald-100"}`}>
            {groups.length > 0
              ? <AlertCircle className="h-5 w-5 text-amber-600" />
              : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          </div>
          <div>
            <p className={`font-bold text-sm ${groups.length > 0 ? "text-amber-900" : "text-emerald-800"}`}>
              {groups.length > 0
                ? (language === "ar" ? `تم العثور على ${groups.length} مجموعة تكرار محتملة` : `Found ${groups.length} potential duplicate group(s)`)
                : (language === "ar" ? "لا توجد تكرارات" : "No duplicates found")}
            </p>
            <p className={`text-xs mt-0.5 ${groups.length > 0 ? "text-amber-700" : "text-emerald-600"}`}>
              {groups.length > 0
                ? (language === "ar" ? "راجع المجموعات أدناه واحذف السجلات المكررة" : "Review the groups below and delete the duplicate records")
                : (language === "ar" ? "جميع السجلات فريدة وخالية من التكرار" : "All records are unique — no action needed")}
            </p>
          </div>
        </div>

        {/* Duplicate groups */}
        {groups.length > 0 && (
          <div className="space-y-4 max-h-[55vh] overflow-y-auto">
            {groups.map((group, gi) => (
              <div key={group.key} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Group header */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">{gi + 1}</span>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {language === "ar" ? `${group.items.length} سجلات متشابهة` : `${group.items.length} similar records`}
                    </span>
                  </div>
                  <button onClick={() => handleKeep(group.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {language === "ar" ? "تجاهل المجموعة" : "Mark Reviewed"}
                  </button>
                </div>

                {/* Records in group */}
                <div className="divide-y divide-slate-100">
                  {group.items.map((item, ii) => (
                    <div key={item.id} className={`flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors ${ii === 0 ? "" : "bg-rose-50/30"}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${ii === 0 ? "bg-emerald-400" : "bg-rose-400"}`}
                          title={ii === 0 ? (language === "ar" ? "الأصل المحتمل" : "Potential Original") : (language === "ar" ? "نسخة مكررة محتملة" : "Potential Duplicate")} />
                        <div className="flex-1 min-w-0">
                          {config.renderRow ? config.renderRow(item, language) : defaultRender(item)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ms-3">
                        {ii === 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            {language === "ar" ? "أصل" : "Original"}
                          </span>
                        )}
                        {ii > 0 && (
                          <>
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                              {language === "ar" ? "مكرر" : "Duplicate"}
                            </span>
                            <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors disabled:opacity-50">
                              <Trash2 className="h-3.5 w-3.5" />
                              {language === "ar" ? "حذف" : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {language === "ar" ? `إجمالي السجلات: ${data.length}` : `Total records scanned: ${data.length}`}
          </p>
          <button onClick={onClose}
            className="px-5 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-colors">
            {language === "ar" ? "إنهاء المراجعة" : "Finish Review"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ── Duplicate trigger button ──────────────────────────────────────────────────

interface DuplicateScanButtonProps {
  data: any[];
  config: DuplicateConfig;
  className?: string;
}

export const DuplicateScanButton: React.FC<DuplicateScanButtonProps> = ({
  data, config, className = ""
}) => {
  const { language } = useUIStore();
  const [open, setOpen] = React.useState(false);

  // Count duplicates without opening modal
  const dupeCount = React.useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach(item => {
      const key = config.keyFields.map(f => {
        const v = item[f];
        if (v == null) return "";
        if (typeof v === "number") return v.toFixed(2);
        return String(v).toLowerCase().trim();
      }).join("|");
      map[key] = (map[key] || 0) + 1;
    });
    return Object.values(map).filter(c => c > 1).length;
  }, [data, config.keyFields]);

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-md transition-colors ${dupeCount > 0 ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"} ${className}`}>
        <ScanSearch className="h-3.5 w-3.5" />
        {language === "ar" ? "فحص التكرار" : "Scan Duplicates"}
        {dupeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {dupeCount}
          </span>
        )}
      </button>
      <DuplicateScanner isOpen={open} onClose={() => setOpen(false)} data={data} config={config} />
    </>
  );
};

export default DuplicateScanner;
