import * as React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileBottomNav from "./MobileBottomNav";
import { useUIStore } from "../../stores/uiStore";

export const AppLayout: React.FC = () => {
  const language = useUIStore((state) => state.language);
  const dir = language === "ar" ? "rtl" : "ltr";

  React.useEffect(() => {
    // Sync initial HTML directions per store language
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", language);
  }, [language, dir]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F1F5F9] text-[#0F172A]" dir={dir}>
      {/* Sidebar - Navigation bar */}
      <Sidebar />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header - top bar controls */}
        <Header />

        {/* Dynamic page container */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Touch Screen Nav */}
      <MobileBottomNav />
    </div>
  );
};
export default AppLayout;
