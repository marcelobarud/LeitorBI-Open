import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const sampleReport = {
  summary: {
    Dashboard: "Demo Publica Comercial", Modelo: "Modelo Demo", "Modo padrao": "Import",
    "Data de exportacao": "2026-07-09", Cultura: "pt-BR", "Tabelas totais": 1, "Colunas totais": 2,
    "Colunas utilizadas": 2, "Colunas utilizadas em medidas": 1, Medidas: 1, "Fontes de dados": 1, "Tipos de fontes": "SQL", Relacionamentos: 0,
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

describe("LeitorBI Open", () => {
  it("exibe a landing pública com as ações principais", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /leia modelos power bi/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /iniciar/i })).toHaveLength(2);
    expect(screen.getAllByText("LeitorBI Open")).not.toHaveLength(0);
    expect(document.querySelector(".brand--landing .brand-mark")).toHaveTextContent("LB");
    expect(screen.queryByText("OPEN / JSON")).not.toBeInTheDocument();
    expect(screen.queryByText("ÍNDICE · 01")).not.toBeInTheDocument();
    expect(document.querySelector(".index-stamp")?.textContent).toContain("LeitorBI");
    expect(document.querySelector(".index-stamp")?.textContent).toContain("Open");
    expect(screen.getByText("Análise Técnica")).toBeInTheDocument();
    expect(screen.getByText("Tenha controle do seu modelo · leitura técnica e rastreável.")).toBeInTheDocument();
    expect(screen.queryByText("CADERNO")).not.toBeInTheDocument();
    expect(screen.queryByText("FOLHA 01 / 04")).not.toBeInTheDocument();
    expect(screen.queryByText("01")).not.toBeInTheDocument();
    expect(screen.queryByText("02")).not.toBeInTheDocument();
    expect(screen.queryByText("03")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".landing-index .benefit-marker")).toHaveLength(3);
    expect(document.querySelectorAll(".landing-index li")).toHaveLength(3);
    const tabularEditorLink = screen.getByRole("link", { name: "Tabular Editor" });
    expect(tabularEditorLink).toHaveAttribute("href", "https://github.com/TabularEditor/TabularEditor/releases/latest");
    expect(tabularEditorLink).toHaveAttribute("target", "_blank");
    expect(tabularEditorLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(document.querySelector(".landing-steps article p")?.textContent).toBe("Abra o PBIX no Power BI, conecte o Tabular Editor e gere o JSON do modelo com o Script PBIModelExport.");
    expect(screen.getByRole("link", { name: /como usar/i })).toHaveAttribute("href", "#como-usar");
    expect(screen.getByRole("link", { name: /ver demonstração/i })).toHaveAttribute("href", "/demo");
  });

  it("padroniza o link técnico PBIModelExport na Landing e no Tutorial", async () => {
    const { unmount } = render(<App />);
    const landingScriptLink = screen.getByRole("link", { name: "PBIModelExport" });
    expect(landingScriptLink).toHaveAttribute("href", "https://github.com/hihipy/pbi-model-export/blob/main/PBIModelExport.csx");
    expect(landingScriptLink).toHaveAttribute("target", "_blank");
    expect(landingScriptLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByText("PBIExportModel")).not.toBeInTheDocument();

    unmount();
    window.history.pushState(null, "", "/app");
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Tutorial" }));
    const tutorialScriptLink = screen.getByRole("link", { name: "PBIModelExport" });
    expect(tutorialScriptLink).toHaveAttribute("href", "https://github.com/hihipy/pbi-model-export/blob/main/PBIModelExport.csx");
    expect(tutorialScriptLink).toHaveAttribute("target", "_blank");
    expect(tutorialScriptLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(document.querySelector(".tutorial-step p")?.textContent).toBe("Baixe e instale o Tabular Editor antes de iniciar a extração.");
    const tutorialTabularEditorLink = screen.getByRole("link", { name: "Tabular Editor" });
    expect(tutorialTabularEditorLink).toHaveAttribute("href", "https://github.com/TabularEditor/TabularEditor/releases/latest");
    expect(tutorialTabularEditorLink).toHaveAttribute("target", "_blank");
    expect(tutorialTabularEditorLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("abre o workspace diretamente ao iniciar, sem consultar autenticação", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ detail: "unexpected" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await userEvent.click(screen.getAllByRole("button", { name: /iniciar/i })[0]);
    expect(await screen.findByText(/nenhum modelo carregado/i)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("informa quando a API aplica rate limiting", async () => {
    mockFetch((url) => url.includes("/api/models/analyze")
      ? new Response(JSON.stringify({ detail: "Limite de requisições atingido." }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "30" },
        })
      : jsonResponse({ detail: "Not found" }, { status: 404 }));
    const { container } = render(<App />);
    await userEvent.click(screen.getAllByRole("button", { name: /iniciar/i })[0]);
    const input = await waitFor(() => container.querySelector<HTMLInputElement>('input[type="file"]'));
    await userEvent.upload(input!, new File([JSON.stringify({ tables: [] })], "modelo.json", { type: "application/json" }));
    expect(await screen.findByText(/muitas solicitações em sequência/i)).toBeInTheDocument();
  });

  it("retorna à landing pelo nome do produto no workspace", async () => {
    window.history.pushState(null, "", "/app");
    render(<App />);
    expect(document.querySelector(".brand--sidebar .brand-mark")).toHaveTextContent("LB");
    await userEvent.click(screen.getByRole("button", { name: /voltar para a landing page/i }));
    expect(window.location.pathname).toBe("/");
    expect(screen.getAllByRole("button", { name: /iniciar/i })).toHaveLength(2);
  });

  it("carrega a demonstração pública", async () => {
    window.history.pushState(null, "", "/demo");
    mockFetch((url) => url.includes("/api/public/demo/analyze") ? jsonResponse(sampleReport) : jsonResponse({ detail: "Not found" }, { status: 404 }));
    render(<App />);
    expect(await screen.findByText(/prévia somente para leitura/i)).toBeInTheDocument();
    expect(await screen.findAllByText("Demo Publica Comercial")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /entrar/i })).not.toBeInTheDocument();
  });

  it("retorna à landing pelo nome do produto na demonstração", async () => {
    window.history.pushState(null, "", "/demo");
    mockFetch((url) => url.includes("/api/public/demo/analyze") ? jsonResponse(sampleReport) : jsonResponse({ detail: "Not found" }, { status: 404 }));
    render(<App />);
    await screen.findByRole("button", { name: /voltar para a landing page/i });
    await userEvent.click(screen.getByRole("button", { name: /voltar para a landing page/i }));
    expect(window.location.pathname).toBe("/");
    expect(screen.getAllByRole("button", { name: /iniciar/i })).toHaveLength(2);
  });

  it("analisa um JSON sem sessão e mantém a navegação do workspace", async () => {
    mockFetch((url) => url.includes("/api/models/analyze") ? jsonResponse(sampleReport) : jsonResponse({ detail: "Not found" }, { status: 404 }));
    const { container } = render(<App />);
    await userEvent.click(screen.getAllByRole("button", { name: /iniciar/i })[0]);
    const input = await waitFor(() => container.querySelector<HTMLInputElement>('input[type="file"]'));
    const file = new File([JSON.stringify({ tables: [] })], "modelo.json", { type: "application/json" });
    await userEvent.upload(input!, file);
    expect(await screen.findByRole("heading", { name: "Demo Publica Comercial" })).toBeInTheDocument();
    expect(Array.from(document.querySelectorAll(".summary-list span"), (node) => node.textContent)).toEqual([
      "Dashboard", "Tabelas totais", "Modelo", "Colunas totais", "Data de exportação", "Colunas utilizadas em medidas",
      "Cultura", "Medidas", "Modo padrão", "Relacionamentos", "Tipos de fontes", "Fontes de Dados",
    ]);
    expect(screen.getByText("Colunas utilizadas em medidas", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Colunas utilizadas", { exact: true })).not.toBeInTheDocument();
    expect(document.querySelector(".summary-columns")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /relacionamentos/i }));
    expect(screen.getByRole("heading", { name: /relacionamentos/i })).toBeInTheDocument();
  });

  it("analisa um ZIP PBIP pelo mesmo fluxo do JSON", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => input.toString().includes("/api/models/analyze")
      ? jsonResponse(sampleReport)
      : jsonResponse({ detail: "Not found" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<App />);
    await userEvent.click(screen.getAllByRole("button", { name: /iniciar/i })[0]);
    const input = await waitFor(() => container.querySelector<HTMLInputElement>('input[type="file"]'));
    await userEvent.upload(input!, new File(["PK"], "modelo.pbip.zip", { type: "application/zip" }));
    expect(await screen.findByRole("heading", { name: "Demo Publica Comercial" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/models/analyze"), expect.objectContaining({
      method: "POST",
      body: expect.any(FormData),
    }));
  });

  it("compara dois ZIPs PBIP pelo seletor único de arquivos", async () => {
    const comparison = {
      dashboard_base: "Demo base",
      dashboard_novo: "Demo novo",
      tabelas: { adicionadas: [], removidas: [], modificadas: [] },
      colunas: { adicionadas: [], removidas: [], modificadas: [] },
      medidas: { adicionadas: [], removidas: [], modificadas: [] },
      relacionamentos: { adicionados: [], removidos: [], modificados: [] },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => input.toString().includes("/api/models/compare")
      ? jsonResponse(comparison)
      : jsonResponse({ detail: "Not found" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<App />);
    await userEvent.click(screen.getAllByRole("button", { name: /iniciar/i })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Comparar" }));
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>(".compare-file input"));
    await userEvent.upload(inputs[0], new File(["PK"], "base.zip", { type: "application/zip" }));
    await userEvent.upload(inputs[1], new File(["PK"], "novo.zip", { type: "application/zip" }));
    await userEvent.click(screen.getByRole("button", { name: /comparar modelos/i }));
    expect(await screen.findByText(/demo base para demo novo/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/models/compare"), expect.objectContaining({
      method: "POST",
      body: expect.any(FormData),
    }));
  });

  it("envia projetos PBIP TMDL pelo mesmo fluxo do ZIP", async () => {
    mockFetch((url) => url.includes("/api/models/analyze")
      ? jsonResponse(sampleReport)
      : jsonResponse({ detail: "Not found" }, { status: 404 }));
    const { container } = render(<App />);
    await userEvent.click(screen.getAllByRole("button", { name: /iniciar/i })[0]);
    const input = await waitFor(() => container.querySelector<HTMLInputElement>('input[type="file"]'));
    await userEvent.upload(input!, new File(["PK"], "tmdl.zip", { type: "application/zip" }));
    expect(await screen.findByRole("heading", { name: "Demo Publica Comercial" })).toBeInTheDocument();
  });

  it("bloqueia upload inválido antes de enviar para a API", async () => {
    const fetchMock = vi.fn(() => jsonResponse({ detail: "Not found" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<App />);
    await userEvent.click(screen.getAllByRole("button", { name: /iniciar/i })[0]);
    const input = await waitFor(() => container.querySelector<HTMLInputElement>('input[type="file"]'));
    await userEvent.setup({ applyAccept: false }).upload(input!, new File(["not json"], "modelo.txt", { type: "text/plain" }));
    expect(await screen.findByText(/arquivo json válido/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
