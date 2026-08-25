"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries, locales, type Locale } from "./dictionaries";

const STORAGE_KEY = "orchestrator:locale";

type Dict = (typeof dictionaries)["id"];

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("id");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (locales as string[]).includes(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted locale on mount, same pattern as next-themes
      setLocaleState(stored as Locale);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: dictionaries[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}
