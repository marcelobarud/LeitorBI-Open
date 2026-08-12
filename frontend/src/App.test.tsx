import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const sampleReport = {
  summary: {
    Dashboard: "Demo Publica Comercial", Modelo: "Modelo Demo", "Modo padrao": "Import",
    "Data de exportacao": "2026-07-09", "Tabelas totais": 1, "Colunas totais": 2,
    "Colunas utilizadas": 2, Medidas: 1, "Fontes de dados": 1, "Tipos de fontes": "SQL", Relacionamentos: 0,
  },
  tables: [{ Tabela: "Fato Vendas Demo", Tipo: "Regular", Oculta: "Não" }],
  columns: [{ Tabela: "Fato Vendas Demo", Coluna: "Receita", Oculto: "Não" }],
  measures: [{ Tabela: "Fato Vendas Demo", Medida: "Receita Total", "Expressao DAX": "SUM([Receita])" }],
  sources: [{ Tabela: "Fato Vendas Demo", "Fonte detectada": "SQL", Servidor: "demo-sql-server" }],
  relationships: [], columnsUsedInMeasures: [],
  raw: { dashboardName: "Demo Publica Comercial", modelName: "Modelo Demo", exportDate: "2026-07-09" },
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { "Content-Type": "application/json" } });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)));
}

beforeEach(() => window.history.pushState(null, "", "/"));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("LeitorBI-Web Open", () => {
  it("exibe a landing pública com as ações principais", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /leia modelos power bi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /como usar/i })).toHaveAttribute("href", "#como-usar");
    expect(screen.getByRole("link", { name: /ver demonstração/i })).toHaveAttribute("href", "/demo");
  });

  it("abre o workspace diretamente ao iniciar, sem consultar autenticação", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ detail: "unexpected" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /iniciar/i }));
    expect(await screen.findByText(/nenhum modelo carregado/i)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carrega a demonstração pública", async () => {
    window.history.pushState(null, "", "/demo");
    mockFetch((url) => url.includes("/api/public/demo/analyze") ? jsonResponse(sampleReport) : jsonResponse({ detail: "Not found" }, { status: 404 }));
    render(<App />);
    expect(await screen.findByText(/prévia somente para leitura/i)).toBeInTheDocument();
    expect(await screen.findAllByText("Demo Publica Comercial")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /entrar/i })).not.toBeInTheDocument();
  });

  it("analisa um JSON sem sessão e mantém a navegação do workspace", async () => {
    mockFetch((url) => url.includes("/api/models/analyze") ? jsonResponse(sampleReport) : jsonResponse({ detail: "Not found" }, { status: 404 }));
    const { container } = render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /iniciar/i }));
    const input = await waitFor(() => container.querySelector<HTMLInputElement>('input[type="file"]'));
    const file = new File([JSON.stringify({ tables: [] })], "modelo.json", { type: "application/json" });
    await userEvent.upload(input!, file);
    expect(await screen.findByRole("heading", { name: "Demo Publica Comercial" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /relacionamentos/i }));
    expect(screen.getByRole("heading", { name: /relacionamentos/i })).toBeInTheDocument();
  });

  it("bloqueia upload inválido antes de enviar para a API", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ detail: "Not found" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /iniciar/i }));
    const input = await waitFor(() => container.querySelector<HTMLInputElement>('input[type="file"]'));
    await userEvent.setup({ applyAccept: false }).upload(input!, new File(["not json"], "modelo.txt", { type: "text/plain" }));
    expect(await screen.findByText(/arquivo json válido/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
