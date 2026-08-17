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

  it("renderiza o filtro em portal e preserva busca, seleção e limpeza", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        rows={[
          { Nome: "Tabela A", Tipo: "Regular" },
          { Nome: "Tabela B", Tipo: "Regular" },
        ]}
      />,
    );

    const filterButton = screen.getByRole("button", { name: "Filtrar coluna Nome" });
    await user.click(filterButton);

    const menu = document.querySelector(".column-filter-menu") as HTMLElement;
    expect(menu).toBeInTheDocument();
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveStyle({ position: "fixed" });
    expect(filterButton).toHaveAttribute("aria-expanded", "true");

    await user.type(within(menu).getByPlaceholderText("Buscar Nome"), "Tabela A");
    await user.click(within(menu).getByRole("checkbox", { name: "Tabela A" }));
    expect(within(menu).getByText("1 valor selecionado")).toBeInTheDocument();

    await user.click(within(menu).getByRole("button", { name: "Fechar" }));
    expect(document.querySelector(".column-filter-menu")).not.toBeInTheDocument();
    expect(screen.queryByText("Tabela B")).not.toBeInTheDocument();

    await user.click(filterButton);
    const reopenedMenu = document.querySelector(".column-filter-menu") as HTMLElement;
    await user.click(within(reopenedMenu).getByRole("button", { name: "Limpar" }));
    expect(document.querySelector(".column-filter-menu")).not.toBeInTheDocument();
    expect(screen.getByText("Tabela B")).toBeInTheDocument();
  });

  it("fecha o filtro por Escape e clique externo", async () => {
    const user = userEvent.setup();
    render(<DataTable rows={[{ Nome: "Tabela A" }]} />);

    const filterButton = screen.getByRole("button", { name: "Filtrar coluna Nome" });
    await user.click(filterButton);
    await user.keyboard("{Escape}");
    expect(document.querySelector(".column-filter-menu")).not.toBeInTheDocument();
    expect(filterButton).toHaveFocus();

    await user.click(filterButton);
    expect(document.querySelector(".column-filter-menu")).toBeInTheDocument();
    await user.click(document.body);
    expect(document.querySelector(".column-filter-menu")).not.toBeInTheDocument();
  });

  it("mantém as coordenadas congeladas quando ocorre scroll", async () => {
    const user = userEvent.setup();
    render(<DataTable rows={[{ Nome: "Tabela A", Tipo: "Regular" }]} />);

    await user.click(screen.getByRole("button", { name: "Filtrar coluna Nome" }));
    const menu = document.querySelector(".column-filter-menu") as HTMLElement;
    const initialPosition = {
      left: menu.style.left,
      top: menu.style.top,
    };

    window.dispatchEvent(new Event("scroll"));

    expect(menu).toHaveStyle({ position: "fixed" });
    expect(menu.style.left).toBe(initialPosition.left);
    expect(menu.style.top).toBe(initialPosition.top);
  });
});
