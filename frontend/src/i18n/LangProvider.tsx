import { createContext, useContext, useState, ReactNode } from 'react';
import { translations, type Lang, type T } from './index';

interface LangContext {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
}

const LangCtx = createContext<LangContext>({
  lang: 'en',
  setLang: () => {},
  t: translations.en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const stored = (localStorage.getItem('osint_lang') as Lang) || 'en';
  const [lang, setLangState] = useState<Lang>(stored);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('osint_lang', l);
  };

  return (
    <LangCtx.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangCtx.Provider>
  );
}

export const useLang = () => useContext(LangCtx);
