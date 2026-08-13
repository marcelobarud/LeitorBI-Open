import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTable } from "./DataTable";

describe("DataTable", () => {
  it("torna todas as linhas expansíveis mesmo com conteúdo curto", async () => {
    render(
      <DataTable
        rows={[
          { Nome: "Tabela A", Tipo: "Regular" },
          { Nome: "Tabela B", Tipo: "Regular" },
        ]}
      />,
    );

    const expandButtons = screen.getAllByRole("button", { name: "Expandir linha" });
    expect(expandButtons).toHaveLength(2);
    expect(expandButtons[0]).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(expandButtons[0]);

    expect(screen.getByRole("button", { name: "Recolher linha" })).toHaveAttribute("aria-expanded", "true");
    const expandedRow = document.querySelector(".expanded-row");
    expect(expandedRow).toBeInTheDocument();
    expect(within(expandedRow as HTMLElement).getByText("Nome")).toBeInTheDocument();
    expect(within(expandedRow as HTMLElement).getByText("Tabela A")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Recolher linha" }));
    expect(screen.queryByRole("button", { name: "Recolher linha" })).not.toBeInTheDocument();
    expect(document.querySelector(".expanded-row")).not.toBeInTheDocument();
  });
});
