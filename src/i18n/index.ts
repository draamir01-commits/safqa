import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import arTranslations from "./ar.json";
import enTranslations from "./en.json";

// i18next configuration
i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: arTranslations },
      en: { translation: enTranslations }
    },
    lng: "ar", // Default to Arabic for Saudi KSA market
    fallbackLng: "ar",
    interpolation: {
      escapeValue: false // React already escapes values to prevent XSS
    }
  });

export default i18n;
