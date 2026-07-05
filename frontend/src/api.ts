import type { CompareResult, Report } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function readError(response: Response, fallback: string) {
  const error = await response.json().catch(() => ({ detail: fallback }));
  if (typeof error.detail === "string") return error.detail;
  return fallback;
}

async function fetchApi(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw new Error("Não foi possível conectar à API. Verifique se o backend está rodando e se VITE_API_URL está correto.");
  }
}

export async function analyzeModel(file: File): Promise<Report> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetchApi(`${API_URL}/api/models/analyze`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Erro ao analisar arquivo."));
  }

  return response.json();
}

export async function compareModels(base: File, novo: File): Promise<CompareResult> {
  const form = new FormData();
  form.append("base", base);
  form.append("novo", novo);

  const response = await fetchApi(`${API_URL}/api/models/compare`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Erro ao comparar arquivos."));
  }

  return response.json();
}

export async function analyzeDemoModel(): Promise<Report> {
  const response = await fetchApi(`${API_URL}/api/demo/analyze`);

  if (!response.ok) {
    throw new Error(await readError(response, "Erro ao carregar modelo de exemplo."));
  }

  return response.json();
}

export async function exportModelExcel(file: File): Promise<Blob> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetchApi(`${API_URL}/api/models/export-excel`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Erro ao exportar Excel."));
  }

  return response.blob();
}

export async function exportDemoExcel(): Promise<Blob> {
  const response = await fetchApi(`${API_URL}/api/demo/export-excel`);

  if (!response.ok) {
    throw new Error(await readError(response, "Erro ao exportar exemplo."));
  }

  return response.blob();
}
