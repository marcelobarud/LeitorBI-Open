import type { AuthUser, CompareResult, ManagedUser, Report } from "./types";

const configuredApiUrl = import.meta.env.VITE_API_URL;
const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_URL = configuredApiUrl ?? (isLocalHost ? `${window.location.protocol}//${window.location.hostname}:8000` : "");
const AUTH_REQUIRED_MESSAGE = "Sessão expirada. Entre novamente.";

async function readError(response: Response, fallback: string) {
  const error = await response.json().catch(() => ({ detail: fallback }));
  if (typeof error.detail === "string") return error.detail;
  return fallback;
}

async function fetchApi(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, {
      ...init,
      credentials: "include",
    });
  } catch (error) {
    throw new Error("Não foi possível conectar à API. Verifique se o backend está rodando e se VITE_API_URL está correto.");
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetchApi(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(await readError(response, "Muitas tentativas. Aguarde alguns minutos e tente novamente."));
    }
    throw new Error("E-mail ou senha inválidos.");
  }

  return response.json();
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthUser> {
  const response = await fetchApi(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error("Não foi possível concluir o cadastro. Revise os dados e tente novamente.");
    }
    throw new Error(await readError(response, "Erro ao criar conta."));
  }

  return response.json();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetchApi(`${API_URL}/api/auth/me`);

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readError(response, "Erro ao verificar sessão."));
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const response = await fetchApi(`${API_URL}/api/auth/logout`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Erro ao sair."));
  }
}

export async function listUsers(): Promise<ManagedUser[]> {
  const response = await fetchApi(`${API_URL}/api/admin/users`);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    if (response.status === 403) {
      throw new Error("Acesso restrito a administradores.");
    }
    throw new Error(await readError(response, "Erro ao carregar usuários."));
  }

  return response.json();
}

export async function createUser(name: string, email: string, password: string, isAdmin: boolean): Promise<ManagedUser> {
  const response = await fetchApi(`${API_URL}/api/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password, is_admin: isAdmin }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    if (response.status === 403) {
      throw new Error("Acesso restrito a administradores.");
    }
    throw new Error(await readError(response, "Erro ao criar usuário."));
  }

  return response.json();
}

export async function deleteUser(userId: number): Promise<void> {
  const response = await fetchApi(`${API_URL}/api/admin/users/${userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    if (response.status === 403) {
      throw new Error("Acesso restrito a administradores.");
    }
    throw new Error(await readError(response, "Erro ao remover usuário."));
  }
}

export async function updateUser(
  userId: number,
  changes: Partial<Pick<ManagedUser, "is_admin" | "disabled">>,
): Promise<ManagedUser> {
  const response = await fetchApi(`${API_URL}/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(changes),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    if (response.status === 403) {
      throw new Error("Acesso restrito a administradores.");
    }
    throw new Error(await readError(response, "Erro ao atualizar usuário."));
  }

  return response.json();
}

export async function analyzeModel(file: File): Promise<Report> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetchApi(`${API_URL}/api/models/analyze`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
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
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    throw new Error(await readError(response, "Erro ao comparar arquivos."));
  }

  return response.json();
}

export async function analyzeDemoModel(): Promise<Report> {
  const response = await fetchApi(`${API_URL}/api/demo/analyze`);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    throw new Error(await readError(response, "Erro ao carregar modelo de exemplo."));
  }

  return response.json();
}

export async function analyzePublicDemoModel(): Promise<Report> {
  const response = await fetchApi(`${API_URL}/api/public/demo/analyze`);

  if (!response.ok) {
    throw new Error(await readError(response, "Erro ao carregar demonstração."));
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
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    throw new Error(await readError(response, "Erro ao exportar Excel."));
  }

  return response.blob();
}

export async function exportDemoExcel(): Promise<Blob> {
  const response = await fetchApi(`${API_URL}/api/demo/export-excel`);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(AUTH_REQUIRED_MESSAGE);
    }
    throw new Error(await readError(response, "Erro ao exportar exemplo."));
  }

  return response.blob();
}
