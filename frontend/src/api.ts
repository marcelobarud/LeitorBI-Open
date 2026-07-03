import type { CompareResult, Report } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function analyzeModel(file: File): Promise<Report> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_URL}/api/models/analyze`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Erro ao analisar arquivo." }));
    throw new Error(error.detail ?? "Erro ao analisar arquivo.");
  }

  return response.json();
}

export async function compareModels(base: File, novo: File): Promise<CompareResult> {
  const form = new FormData();
  form.append("base", base);
  form.append("novo", novo);

  const response = await fetch(`${API_URL}/api/models/compare`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Erro ao comparar arquivos." }));
    throw new Error(error.detail ?? "Erro ao comparar arquivos.");
  }

  return response.json();
}
