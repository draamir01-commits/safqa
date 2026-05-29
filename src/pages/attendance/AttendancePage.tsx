import * as React from "react";
import { Plus, CheckCircle, XCircle, Clock, Calendar, Users, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { listenCompanyCollection, addDocument, updateDocument } from "../../firebase/firestore";
import { AttendanceRecord } from "../../types";
import Button from "../../components/ui/Button";
import Select from "../../components/ui/Select";
import { ExportButton } from "../../components/ui/ExportButton";

interface Employee { id: string; name: string; nameAr: string; }

const statusColor: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-red-100 text-red-700",
  late: "bg-amber-100 text-amber-700",
  half_day: "bg-blue-100 text-blue-700",
  holiday: "bg-purple-100 text-purple-700",
};

export const AttendancePage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [records, setRecords] = React.useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().toISOString().slice(0, 7));

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "attendance", d => setRecords(d as AttendanceRecord[]));
    const u2 = listenCompanyCollection(currentCompany.id, "employees", d => setEmployees(d as Employee[]));
    return () => { u1(); u2(); };
  }, [currentCompany]);

  const dayRecords = records.filter(r => r.date === selectedDate);
  const monthRecords = records.filter(r => r.date.startsWith(selectedMonth));

  const getStatus = (empId: string) => dayRecords.find(r => r.employeeId === empId)?.status || null;

  const markAttendance = async (empId: string, empName: string, status: string) => {
    if (!currentCompany || !user) return;
    setLoading(true);
    try {
      const existing = dayRecords.find(r => r.employeeId === empId);
      if (existing) {
        await updateDocument(`companies/${currentCompany.id}/attendance`, existing.id, { status, updatedAt: new Date() });
      } else {
        await addDocument(`companies/${currentCompany.id}/attendance`, {
          employeeId: empId, employeeName: empName, date: selectedDate,
          status, createdBy: user.uid, createdAt: new Date(),
        });
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const markAll = async (status: string) => {
    for (const emp of employees) {
      await markAttendance(emp.id, language === "ar" ? emp.nameAr || emp.name : emp.name, status);
    }
    toast.success(language === "ar" ? "تم تحديث الجميع" : "All updated");
  };

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      present: ["حاضر", "Present"], absent: ["غائب", "Absent"],
      late: ["متأخر", "Late"], half_day: ["نصف يوم", "Half Day"], holiday: ["إجازة", "Holiday"]
    };
    return map[s]?.[language === "ar" ? 0 : 1] || s;
  };

  const stats = {
    present: monthRecords.filter(r => r.status === "present").length,
    absent: monthRecords.filter(r => r.status === "absent").length,
    late: monthRecords.filter(r => r.status === "late").length,
    holiday: monthRecords.filter(r => r.status === "holiday").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "سجل الحضور والغياب" : "Attendance Tracking"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "تسجيل حضور وغياب الموظفين يومياً" : "Track daily employee attendance"}</p>
        </div>
        <ExportButton data={monthRecords} filename={`attendance-${selectedMonth}`} headers={{ date: "Date", employeeName: "Employee", status: "Status" }} />
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: language === "ar" ? "حاضر" : "Present", value: stats.present, color: "text-emerald-600" },
          { label: language === "ar" ? "غائب" : "Absent", value: stats.absent, color: "text-red-600" },
          { label: language === "ar" ? "متأخر" : "Late", value: stats.late, color: "text-amber-600" },
          { label: language === "ar" ? "إجازة" : "Holiday", value: stats.holiday, color: "text-purple-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label} ({language === "ar" ? "هذا الشهر" : "This Month"})</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "التاريخ" : "Date"}</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "الشهر" : "Month"}</label>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
        </div>
        <div className="ms-auto flex gap-2">
          <button onClick={() => markAll("present")} className="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 font-semibold rounded-md hover:bg-emerald-200 transition-colors">
            {language === "ar" ? "تحضير الجميع" : "Mark All Present"}
          </button>
          <button onClick={() => markAll("absent")} className="text-xs px-3 py-1.5 bg-red-100 text-red-700 font-semibold rounded-md hover:bg-red-200 transition-colors">
            {language === "ar" ? "غياب الجميع" : "Mark All Absent"}
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{language === "ar" ? "لا يوجد موظفون. أضف موظفين من صفحة الرواتب أولاً." : "No employees. Add employees from the Payroll page first."}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-700">
            {language === "ar" ? `الحضور ليوم ${selectedDate}` : `Attendance for ${selectedDate}`}
          </div>
          <div className="divide-y divide-slate-100">
            {employees.map(emp => {
              const status = getStatus(emp.id);
              return (
                <div key={emp.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                      {(language === "ar" ? emp.nameAr || emp.name : emp.name)[0]}
                    </div>
                    <span className="text-sm font-medium text-slate-800">{language === "ar" ? emp.nameAr || emp.name : emp.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {status && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[status]}`}>{statusLabel(status)}</span>}
                    <div className="flex gap-1">
                      {["present", "absent", "late", "half_day", "holiday"].map(s => (
                        <button key={s} onClick={() => markAttendance(emp.id, language === "ar" ? emp.nameAr || emp.name : emp.name, s)}
                          className={`px-2 py-1 text-[10px] font-semibold rounded transition-colors ${status === s ? statusColor[s] : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                          {statusLabel(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly summary table */}
      {monthRecords.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-700">
            {language === "ar" ? `ملخص شهر ${selectedMonth}` : `Summary for ${selectedMonth}`}
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[language === "ar" ? "الموظف" : "Employee",
                  language === "ar" ? "حاضر" : "Present",
                  language === "ar" ? "غائب" : "Absent",
                  language === "ar" ? "متأخر" : "Late",
                  language === "ar" ? "إجازة" : "Holiday",
                ].map((h, i) => <th key={i} className="px-4 py-2 font-semibold text-slate-600 text-start">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(emp => {
                const empRecords = monthRecords.filter(r => r.employeeId === emp.id);
                return (
                  <tr key={emp.id}>
                    <td className="px-4 py-2 font-medium text-slate-800">{language === "ar" ? emp.nameAr || emp.name : emp.name}</td>
                    <td className="px-4 py-2 text-emerald-600 font-semibold">{empRecords.filter(r => r.status === "present").length}</td>
                    <td className="px-4 py-2 text-red-500 font-semibold">{empRecords.filter(r => r.status === "absent").length}</td>
                    <td className="px-4 py-2 text-amber-600 font-semibold">{empRecords.filter(r => r.status === "late").length}</td>
                    <td className="px-4 py-2 text-purple-600 font-semibold">{empRecords.filter(r => r.status === "holiday").length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سجل الحضور والغياب" : "Attendance Register"}
        itemCount={employees?.length}
      />
    </div>
  );
};
export default AttendancePage;
