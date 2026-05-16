import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { translations, type InterfaceLanguage, type TranslationKey } from "@/translations";

const languageValues: InterfaceLanguage[] = ["bangla", "english"];

const getInitialLanguage = (): InterfaceLanguage => {
  if (typeof window === "undefined") return "bangla";
  const cached = window.localStorage.getItem("poralekha_interface_language") as InterfaceLanguage | null;
  return cached && languageValues.includes(cached) ? cached : "bangla";
};

type LanguageContextValue = {
  language: InterfaceLanguage;
  t: (key: TranslationKey) => string;
  changeLanguage: (newLanguage: InterfaceLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<InterfaceLanguage>(getInitialLanguage);

  useEffect(() => {
    const loadLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await (supabase as any)
        .from("profiles")
        .select("interface_language")
        .eq("user_id", user.id)
        .maybeSingle();

      const savedLanguage = data?.interface_language as InterfaceLanguage | undefined;
      if (savedLanguage && languageValues.includes(savedLanguage)) {
        setLanguage(savedLanguage);
        window.localStorage.setItem("poralekha_interface_language", savedLanguage);
      }
    };

    void loadLanguage();
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    t: (key) => translations[language]?.[key] ?? translations.bangla[key] ?? key,
    changeLanguage: async (newLanguage) => {
      setLanguage(newLanguage);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("poralekha_interface_language", newLanguage);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any)
          .from("profiles")
          .upsert({ user_id: user.id, interface_language: newLanguage }, { onConflict: "user_id" });
      }
    },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
