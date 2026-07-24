import type { ptBR } from "./translations/pt-BR";

export type SupportedLocale = "pt-BR" | "en-US";

export type TranslationParams = Record<string, string | number>;
export type TranslationCatalog = Record<string, string>;

export type TranslationKey = keyof typeof ptBR;
