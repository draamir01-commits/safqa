import * as React from "react";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import Button from "./Button";

export interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  accessorKey?: keyof T;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchField?: keyof T | ((row: T) => string);
  exportFileName?: string;
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = "Search...",
  searchField,
  exportFileName = "export.csv"
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 8;

  // Filter data
  const filteredData = React.useMemo(() => {
    if (!searchTerm || !searchField) return data;
    return data.filter((row) => {
      let val = "";
      if (typeof searchField === "function") {
        val = searchField(row);
      } else {
        const rawVal = row[searchField];
        val = rawVal ? String(rawVal) : "";
      }
      return val.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [data, searchTerm, searchField]);

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Convert and export data to CSV
  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    
    const headers = columns.map((col) => col.header).join(",");
    const rows = filteredData.map((row) => {
      return columns.map((col) => {
        // Basic plain text cleaner
        const cellNode = col.render(row);
        let cellText = "";
        if (typeof cellNode === "string" || typeof cellNode === "number") {
          cellText = String(cellNode);
        } else {
          cellText = "[Data]";
        }
        return `"${cellText.replace(/"/g, '""')}"`;
      }).join(",");
    });

    const csvContent = "\uFEFF" + [headers, ...rows].join("\n"); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", exportFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {searchField ? (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-slate-400"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset page on filter
              }}
            />
          </div>
        ) : (
          <div />
        )}

        <Button variant="secondary" size="sm" onClick={exportToCSV} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          CSV
        </Button>
      </div>

      {/* Table Container */}
      <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right rtl:text-right ltr:text-left">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-5 py-3 text-right rtl:text-right ltr:text-left whitespace-nowrap">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400">
                  No data matches search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <span className="text-xs text-slate-500 md:text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 min-w-[32px]"
            >
              <ChevronLeft className="h-4 w-4 ltr:hidden" />
              <ChevronRight className="h-4 w-4 rtl:hidden" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 min-w-[32px]"
            >
              <ChevronRight className="h-4 w-4 ltr:hidden" />
              <ChevronLeft className="h-4 w-4 rtl:hidden" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
export default DataTable;
