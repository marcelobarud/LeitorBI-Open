import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CompareView } from "./CompareView";
import type { CompareResult } from "../types";

const baseProps = {
  baseFile: null,
  newFile: null,
  loading: false,
  error: "",
  onBaseFileChange: vi.fn(),
  onNewFileChange: vi.fn(),
  onResultChange: vi.fn(),
  onLoadingChange: vi.fn(),
  onErrorChange: vi.fn(),
  onClear: vi.fn(),
};

function compareResult(overrides: Partial<CompareResult> = {}): CompareResult {
  return {
    dashboard_base: "Modelo Base",
    dashboard_novo: "Modelo Novo",
    tabelas: {
      adicionadas: [],
      removidas: [],
      modificadas: [],
    },
    colunas: {
      adicionadas: [],
      removidas: [],
      modificadas: [],
    },
    medidas: {
      adicionadas: [],
      removidas: [],
      modificadas: [],
    },
    relacionamentos: {
      adicionados: [],
      removidos: [],
      modificados: [],
    },
    ...overrides,
  };
}

function renderCompare(result: CompareResult) {
  return render(<CompareView {...baseProps} result={result} />);
}

async function expandItem(name: string) {
  const item = screen.getByText(name).closest(".change-item");
  expect(item).toBeTruthy();
  await userEvent.click(within(item as HTMLElement).getByRole("button", { name: /expandir detalhe/i }));
  return item as HTMLElement;
}

describe("CompareView", () => {
  it("mostra somente o DAX da versão nova para medida adicionada", async () => {
    renderCompare(compareResult({
      medidas: {
        adicionadas: [{
          tabela: "Fato Vendas",
          medida: "Margem %",
          expressao_dax: "DIVIDE(\n  [Margem],\n  [Receita Total]\n)",
        }],
        removidas: [],
        modificadas: [],
      },
    }));

    const item = await expandItem("Margem %");

    expect(within(item).getByText("Medida DAX")).toBeInTheDocument();
    expect(within(item).getByText(/DIVIDE\(/).textContent).toBe("DIVIDE(\n  [Margem],\n  [Receita Total]\n)");
    expect(within(item).queryByText("Antes")).not.toBeInTheDocument();
    expect(within(item).queryByText("Depois")).not.toBeInTheDocument();
  });

  it("mostra somente o DAX da versão anterior para medida removida", async () => {
    renderCompare(compareResult({
      medidas: {
        adicionadas: [],
        removidas: [{
          tabela: "Fato Vendas",
          medida: "Receita Antiga",
          expressao_dax: "SUM('Fato Vendas'[Receita Antiga])",
        }],
        modificadas: [],
      },
    }));

    const item = await expandItem("Receita Antiga");

    expect(within(item).getByText("Medida DAX")).toBeInTheDocument();
    expect(within(item).getByText("SUM('Fato Vendas'[Receita Antiga])")).toBeInTheDocument();
    expect(within(item).queryByText("Antes")).not.toBeInTheDocument();
    expect(within(item).queryByText("Depois")).not.toBeInTheDocument();
  });

  it("mantem Antes e Depois para medida modificada", async () => {
    renderCompare(compareResult({
      medidas: {
        adicionadas: [],
        removidas: [],
        modificadas: [{
          tabela: "Fato Vendas",
          medida: "Receita Total",
          antes: "SUM('Fato Vendas'[Receita])",
          depois: "SUM('Fato Vendas'[Receita Liquida])",
        }],
      },
    }));

    const item = await expandItem("Receita Total");

    expect(within(item).getByText("Antes")).toBeInTheDocument();
    expect(within(item).getByText("Depois")).toBeInTheDocument();
    expect(within(item).getByText("SUM('Fato Vendas'[Receita])")).toBeInTheDocument();
    expect(within(item).getByText("SUM('Fato Vendas'[Receita Liquida])")).toBeInTheDocument();
  });

  it("exibe mensagem neutra quando medida adicionada não tem expressão", async () => {
    renderCompare(compareResult({
      medidas: {
        adicionadas: [{ tabela: "Fato Vendas", medida: "Sem DAX" }],
        removidas: [],
        modificadas: [],
      },
    }));

    const item = await expandItem("Sem DAX");

    expect(within(item).getByText("Expressão DAX não disponível.")).toBeInTheDocument();
    expect(within(item).queryByText("Antes")).not.toBeInTheDocument();
    expect(within(item).queryByText("Depois")).not.toBeInTheDocument();
  });

  it("permite fechar e reabrir a expansao da medida adicionada", async () => {
    renderCompare(compareResult({
      medidas: {
        adicionadas: [{ tabela: "Fato Vendas", medida: "Receita Nova", expressao_dax: "SUM([Receita Nova])" }],
        removidas: [],
        modificadas: [],
      },
    }));

    const item = await expandItem("Receita Nova");
    expect(within(item).getByText("SUM([Receita Nova])")).toBeInTheDocument();

    await userEvent.click(within(item).getByRole("button", { name: /recolher detalhe/i }));
    expect(within(item).queryByText("SUM([Receita Nova])")).not.toBeInTheDocument();

    await userEvent.click(within(item).getByRole("button", { name: /expandir detalhe/i }));
    expect(within(item).getByText("SUM([Receita Nova])")).toBeInTheDocument();
  });

  it("preserva o comportamento de categorias diferentes de Medidas", async () => {
    renderCompare(compareResult({
      colunas: {
        adicionadas: [{ tabela: "Fato Vendas", coluna: "Receita Nova" }],
        removidas: [],
        modificadas: [],
      },
    }));

    const item = await expandItem("Receita Nova");

    expect(within(item).getByText("tabela")).toBeInTheDocument();
    expect(within(item).getByText("coluna")).toBeInTheDocument();
    expect(within(item).queryByText("Medida DAX")).not.toBeInTheDocument();
  });
});
