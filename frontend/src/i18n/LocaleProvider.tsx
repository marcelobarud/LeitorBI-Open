import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { enUS } from "./translations/en-US";
import { ptBR } from "./translations/pt-BR";
import type { SupportedLocale, TranslationKey, TranslationParams } from "./types";

export type { SupportedLocale } from "./types";

const STORAGE_KEY = "leitorbi.locale";
const catalogs = { "pt-BR": ptBR, "en-US": enUS } as const;

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function formatMessage(message: string, params: TranslationParams = {}) {
  const selected = typeof params.count === "number" && message.includes("|")
    ? message.split("|")[params.count === 1 ? 0 : 1] ?? message
    : message;
  return selected.replace(/{{(\w+)}}/g, (token, name: string) => String(params[name] ?? token));
}

function translate(locale: SupportedLocale, key: TranslationKey, params?: TranslationParams) {
  const message = (catalogs[locale] as Record<TranslationKey, string>)[key] ?? ptBR[key] ?? "";
  return formatMessage(message, params);
}

const knownApiMessages: Record<string, TranslationKey> = {
  "Sessão expirada. Entre novamente.": "auth.sessionExpired",
  "E-mail ou senha inválidos.": "auth.invalidCredentials",
  "Não foi possível conectar à API. Verifique se o backend está rodando e se VITE_API_URL está correto.": "api.connection",
  "Não foi possível concluir o cadastro. Revise os dados e tente novamente.": "api.register",
  "Erro ao verificar sessão.": "api.session",
  "Erro ao carregar usuários.": "api.usersLoad",
  "Erro ao criar usuário.": "api.userCreate",
  "Erro ao remover usuário.": "api.userDelete",
  "Erro ao atualizar usuário.": "api.userUpdate",
  "Erro ao carregar demonstração.": "api.demoLoad",
};

export function translateApiError(message: string, t: LocaleContextValue["t"]) {
  return knownApiMessages[message] ? t(knownApiMessages[message]) : message;
}

export function detectLocale(): SupportedLocale {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "pt-BR" || saved === "en-US") return saved;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => language?.toLowerCase().startsWith("pt")) ? "pt-BR" : "en-US";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectLocale);
  const setLocale = (nextLocale: SupportedLocale) => {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  };
  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale(locale === "pt-BR" ? "en-US" : "pt-BR"),
    t: (key, params) => translate(locale, key, params),
  }), [locale]);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context) return context;
  return { locale: "pt-BR" as SupportedLocale, setLocale: () => undefined, toggleLocale: () => undefined, t: (key: TranslationKey, params?: TranslationParams) => translate("pt-BR", key, params) };
}
