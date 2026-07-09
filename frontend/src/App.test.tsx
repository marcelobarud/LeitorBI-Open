import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const sampleReport = {
  summary: {
    Dashboard: "Demo Publica Comercial",
    Modelo: "Modelo Demo",
    "Modo padrao": "Import",
    "Data de exportacao": "2026-07-09",
    "Tabelas totais": 1,
    "Colunas totais": 2,
    "Colunas utilizadas": 2,
    Medidas: 1,
    "Fontes de dados": 1,
    "Tipos de fontes": "SQL",
    Relacionamentos: 0,
  },
  tables: [{ Tabela: "Fato Vendas Demo", Tipo: "Regular", Oculta: "Não" }],
  columns: [{ Tabela: "Fato Vendas Demo", Coluna: "Receita", Oculto: "Não" }],
  measures: [{ Tabela: "Fato Vendas Demo", Medida: "Receita Total", "Expressao DAX": "SUM([Receita])" }],
  sources: [{ Tabela: "Fato Vendas Demo", "Fonte detectada": "SQL", Servidor: "demo-sql-server" }],
  relationships: [],
  columnsUsedInMeasures: [{ Tabela: "Fato Vendas Demo", Coluna: "Receita" }],
  raw: {
    dashboardName: "Demo Publica Comercial",
    modelName: "Modelo Demo",
    exportDate: "2026-07-09",
  },
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)),
  );
}

function mockAnonymousFetch() {
  mockFetch((url) => {
    if (url.includes("/api/auth/me")) return jsonResponse({ detail: "Autenticacao necessaria." }, { status: 401 });
    if (url.includes("/api/public/demo/analyze")) return jsonResponse(sampleReport);
    return jsonResponse({ detail: "Not found" }, { status: 404 });
  });
}

function mockAuthenticatedFetch(overrides: Record<string, Response | ((init?: RequestInit) => Response)> = {}) {
  mockFetch((url, init) => {
    for (const [path, response] of Object.entries(overrides)) {
      if (url.includes(path)) {
        return typeof response === "function" ? response(init) : response;
      }
    }
    if (url.includes("/api/auth/me")) return jsonResponse({ email: "admin@leitorbi.local", is_admin: true });
    return jsonResponse({ detail: "Not found" }, { status: 404 });
  });
}

beforeEach(() => {
  window.history.pushState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("exibe a landing page para visitantes sem sessão", async () => {
    mockAnonymousFetch();

    render(<App />);

    expect(await screen.findByRole("heading", { name: /leia modelos power bi/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver demonstracao/i })).toHaveAttribute("href", "/demo");
    expect(screen.getByRole("button", { name: /acessar app/i })).toBeInTheDocument();
  });

  it("exibe a demo pública em modo somente leitura", async () => {
    window.history.pushState(null, "", "/demo");
    mockAnonymousFetch();

    render(<App />);

    expect(await screen.findByText(/previa somente leitura/i)).toBeInTheDocument();
    expect(await screen.findAllByText("Demo Publica Comercial")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /carregar json/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /comparar modelos/i })).not.toBeInTheDocument();
  });

  it("permite login e mostra a tela inicial autenticada", async () => {
    mockFetch((url) => {
      if (url.includes("/api/auth/me")) return jsonResponse({ detail: "Autenticacao necessaria." }, { status: 401 });
      if (url.includes("/api/auth/login")) return jsonResponse({ email: "admin@leitorbi.local", is_admin: true });
      return jsonResponse({ detail: "Not found" }, { status: 404 });
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: /acessar app/i }));
    await userEvent.type(screen.getByLabelText(/usuario ou e-mail/i), "admin@leitorbi.local");
    await userEvent.type(screen.getByLabelText(/senha/i), "SenhaForte123!");
    await userEvent.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(await screen.findByText(/nenhum modelo carregado/i)).toBeInTheDocument();
    expect(screen.getByText(/aceita arquivos \.json/i)).toBeInTheDocument();
    expect(screen.getByText("admin@leitorbi.local")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app");
  });

  it("redireciona visitantes de /app para a landing page", async () => {
    window.history.pushState(null, "", "/app");
    mockAnonymousFetch();

    render(<App />);

    expect(await screen.findByRole("heading", { name: /leia modelos power bi/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("redireciona usuários autenticados de /demo para /app", async () => {
    window.history.pushState(null, "", "/demo");
    mockAuthenticatedFetch();

    render(<App />);

    expect(await screen.findByText(/nenhum modelo carregado/i)).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe("/app"));
    expect(screen.queryByText(/previa somente leitura/i)).not.toBeInTheDocument();
  });

  it("carrega um JSON na área autenticada", async () => {
    mockAuthenticatedFetch({
      "/api/models/analyze": jsonResponse(sampleReport),
    });

    const { container } = render(<App />);

    expect(await screen.findByText(/nenhum modelo carregado/i)).toBeInTheDocument();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();

    const file = new File([JSON.stringify({ tables: [] })], "modelo.json", { type: "application/json" });
    await userEvent.setup({ applyAccept: false }).upload(input!, file);

    expect(await screen.findByRole("heading", { name: "Demo Publica Comercial" })).toBeInTheDocument();
    expect(screen.getAllByText(/Modelo Demo/).length).toBeGreaterThan(0);
  });

  it("bloqueia upload com extensão inválida antes de enviar para a API", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/me")) return jsonResponse({ email: "admin@leitorbi.local", is_admin: true });
      if (url.includes("/api/models/analyze")) return jsonResponse(sampleReport);
      return jsonResponse({ detail: "Not found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<App />);

    expect(await screen.findByText(/nenhum modelo carregado/i)).toBeInTheDocument();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["nao e json"], "modelo.txt", { type: "text/plain" });

    await userEvent.setup({ applyAccept: false }).upload(input!, file);

    expect(await screen.findByText(/selecione um arquivo \.json/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/models/analyze"), expect.anything());
  });

  it("renderiza comparação mesmo com payload parcial", async () => {
    mockAuthenticatedFetch({
      "/api/models/compare": jsonResponse({
        dashboard_base: "Base",
        dashboard_novo: "Novo",
        tabelas: { adicionadas: ["Nova Tabela"] },
      }),
    });

    render(<App />);

    await screen.findByText(/nenhum modelo carregado/i);
    await userEvent.click(screen.getByRole("button", { name: /comparar/i }));

    const comparePage = screen.getByRole("heading", { name: "Comparar modelos" }).closest(".compare-page")!;
    const inputs = comparePage.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const base = new File([JSON.stringify({ tables: [] })], "base.json", { type: "application/json" });
    const novo = new File([JSON.stringify({ tables: [] })], "novo.json", { type: "application/json" });

    await userEvent.upload(inputs[0], base);
    await userEvent.upload(inputs[1], novo);
    await userEvent.click(screen.getByRole("button", { name: /^comparar modelos$/i }));

    expect(await screen.findByText(/Base para Novo/)).toBeInTheDocument();
    expect(screen.getByText("Nova Tabela")).toBeInTheDocument();
    expect(screen.queryByText(/não foi possível renderizar/i)).not.toBeInTheDocument();
  });
});
