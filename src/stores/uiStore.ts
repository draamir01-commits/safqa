import { create } from "zustand";
import i18n from "../i18n";

interface UIState {
  sidebarOpen: boolean;
  language: "ar" | "en";
  theme: "light" | "dark";
  toggleSidebar: () => void;
  setLanguage: (lang: "ar" | "en") => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  language: "ar",
  theme: "light",
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setLanguage: (lang) => {
    i18n.changeLanguage(lang);
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
    set({ language: lang });
  },
  toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" }))
}));
