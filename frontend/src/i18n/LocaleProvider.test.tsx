import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocaleProvider, detectLocale, useLocale } from "./LocaleProvider";
import { enUS } from "./translations/en-US";
import { ptBR } from "./translations/pt-BR";

function Probe() {
  const { locale, t, toggleLocale } = useLocale();
  return <><span>{locale}</span><span>{t("comparison.firstItems", { count: 2 })}</span><button onClick={toggleLocale}>toggle</button></>;
}

describe("LocaleProvider", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => { document.documentElement.lang = ""; });

  it("mantém os catálogos com as mesmas chaves", () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(ptBR).sort());
  });

  it("mantém PT-BR como idioma inicial público", () => {
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["pt-PT"] });
    expect(detectLocale()).toBe("pt-BR");
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["es-ES"] });
    expect(detectLocale()).toBe("pt-BR");
  });

  it("não deixa a preferência salva substituir o idioma inicial", () => {
    window.localStorage.setItem("leitorbi.locale", "en-US");
    expect(detectLocale()).toBe("pt-BR");
  });

  it("interpela e pluraliza sem expor a chave", () => {
    render(<LocaleProvider><Probe /></LocaleProvider>);
    expect(screen.getByText("Mostrando os primeiros 2 itens.")).toBeInTheDocument();
    expect(screen.queryByText("comparison.firstItems")).not.toBeInTheDocument();
  });

  it("persiste a troca e atualiza o idioma do documento", async () => {
    window.localStorage.setItem("leitorbi.locale", "pt-BR");
    render(<LocaleProvider><Probe /></LocaleProvider>);
    expect(document.documentElement.lang).toBe("pt-BR");
    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(window.localStorage.getItem("leitorbi.locale")).toBe("en-US");
    expect(document.documentElement.lang).toBe("en-US");
  });
});
