# AI Context — LeitorBI Web

> Documento de contexto vivo do projeto. Atualizado por inspeção do repositório em 11 de julho de 2026. Ele descreve o que existe no código; propostas e próximos passos ficam explicitamente identificados como tal.

## 1. Visão geral

**LeitorBI Web** é a versão web experimental e uma evolução do LeitorBI. O produto transforma exports JSON de modelos Power BI (por exemplo, obtidos via Tabular Editor) em uma análise navegável: inventário de tabelas, colunas, medidas, fontes e relacionamentos; comparação entre versões; e exportação da análise para Excel.

O projeto é composto por uma SPA React e uma API FastAPI independente. Há uma demonstração pública em modo somente leitura, enquanto o workspace com uploads e as operações de análise exigem autenticação.

## 2. Objetivo do produto

- Tornar a estrutura de um modelo Power BI mais fácil de revisar, auditar, explicar e compartilhar.
- Reduzir a leitura manual de JSON, centralizando informações técnicas importantes.
- Permitir comparar duas versões de export do modelo antes de uma publicação.
- Produzir um arquivo Excel com o resultado para reuniões, documentação e revisão com stakeholders.

## 3. Stack e execução

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, Lucide React e CSS próprio |
| Testes frontend | Vitest, Testing Library e jsdom |
| Backend | Python, FastAPI, Uvicorn e Pydantic |
| Dados locais | SQLite para usuários e sessões |
| Exportação | openpyxl |
| Testes backend | pytest |

### Comandos principais

```powershell
# backend
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest

# frontend
cd frontend
npm install
npm run dev
npm test
npm run build
```

O frontend local usa a porta `5173`; por padrão, a API é resolvida em `http://localhost:8000` (ou via `VITE_API_URL`).

## 4. Estrutura de pastas

```text
leitorbi_web/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # composição das telas e estado principal
│   │   ├── api.ts                  # cliente HTTP da API
│   │   ├── types.ts                # contratos do frontend
│   │   ├── routes.ts               # /, /demo e /app
│   │   ├── styles.css              # estilos globais e responsividade
│   │   ├── components/LoginPopover.tsx
│   │   ├── pages/LandingPage.tsx
│   │   └── test/setup.ts
│   ├── scripts/create-sites-worker.mjs
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py                 # aplicação, rotas e middlewares
│   │   ├── auth.py                 # usuários, login e sessões SQLite
│   │   ├── security.py             # CORS e validação de origem
│   │   ├── upload_validation.py    # leitura e validação de JSON
│   │   ├── observability.py        # request ID e logs HTTP
│   │   ├── schemas.py              # contratos Pydantic
│   │   ├── demo_data.py / demo/    # modelo de demonstração
│   │   └── services/
│   │       ├── analyzer.py         # análise do modelo Power BI
│   │       ├── compare.py          # diff de dois modelos
│   │       └── excel_export.py     # geração do XLSX
│   ├── tests/test_core.py
│   └── requirements.txt
├── README.md
└── AI_CONTEXT.md
```

## 5. Arquitetura e fluxo

```text
JSON exportado do Power BI
          |
          v
Frontend React -- multipart/form-data --> API FastAPI
                                         |
                                         +--> validação estrutural e de tamanho
                                         +--> PowerBIAnalyzer / comparação
                                         +--> resposta JSON ou arquivo XLSX
          |
          v
Workspace: resumo, filtros, abas e comparação
```

- A SPA faz roteamento leve pelo History API, sem biblioteca de roteamento: `/` é a landing page, `/demo` a prévia pública e `/app` a área autenticada.
- A sessão é verificada ao abrir a aplicação. Visitantes em `/app` são redirecionados para `/`; usuários autenticados em páginas públicas são enviados a `/app`.
- O frontend envia cookies em todas as chamadas (`credentials: "include"`).
- O backend valida e normaliza o JSON antes de analisar. A análise retorna um `Report` com resumo, tabelas, colunas, medidas, fontes, relacionamentos e colunas usadas em medidas.

## 6. Funcionalidades implementadas

### Acesso e administração

- Landing page com apresentação do produto, acesso e criação de conta.
- Cadastro público de usuários comuns.
- Login e logout por cookie de sessão HTTP-only; sessão dura 8 horas.
- Primeiro administrador opcional criado pelas variáveis `LEITORBI_ADMIN_EMAIL` e `LEITORBI_ADMIN_PASSWORD`.
- Área administrativa para listar, criar, alterar permissões/ativação e remover usuários.
- Proteções para não desativar/remover a própria conta e para manter pelo menos um administrador ativo.

### Análise de modelo

- Upload autenticado de JSON UTF-8, limitado a 10 MB por padrão.
- Validação de extensão, tamanho, JSON e campos estruturais mínimos (`tables`, `relationships` e `modelMetadata`).
- Resumo do dashboard/modelo e métricas de tabelas, colunas, medidas, fontes e relacionamentos.
- Navegação por tabelas, colunas, medidas, fontes e relacionamentos.
- Busca global, filtros por coluna, paginação e expansão de células extensas na tabela de dados.
- Detecção e exclusão de tabelas técnicas/de datas automáticas da leitura principal.
- Leitura de fontes a partir das expressões M das partições.
- Exportação do relatório analisado para Excel.

### Comparação e demonstração

- Comparação autenticada de dois JSONs: itens adicionados, removidos e modificados em tabelas, colunas, medidas e relacionamentos.
- A comparação considera atributos relevantes de cada entidade e ignora tabelas técnicas/de data automáticas.
- Demonstração pública em `/demo`, somente leitura, baseada em `backend/app/demo/public_demo_model.json`.
- Ações de upload, comparação e exportação são ocultadas na demonstração pública.

### Segurança e operação

- Senhas com `scrypt` e salt; tokens de sessão são armazenados como hash SHA-256.
- Limite de cinco tentativas de login por IP/e-mail em uma janela de cinco minutos (em memória do processo).
- CORS configurável por `LEITORBI_CORS_ORIGINS`; curinga é proibido quando cookies são usados.
- Requisições mutáveis validam `Origin` ou `Referer` contra as origens permitidas.
- Logs por requisição com `X-Request-ID`, duração, método, rota e status.

## 7. Endpoints atuais

| Método | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/health` | público | health check |
| POST | `/api/auth/register` | público | criar conta comum |
| POST | `/api/auth/login` | público | iniciar sessão |
| GET | `/api/auth/me` | público | obter usuário da sessão, se houver |
| POST | `/api/auth/logout` | público | encerrar sessão |
| GET | `/api/public/demo/analyze` | público | relatório da demo pública |
| POST | `/api/models/analyze` | autenticado | analisar um export JSON |
| POST | `/api/models/compare` | autenticado | comparar dois exports JSON |
| POST | `/api/models/export-excel` | autenticado | exportar análise para XLSX |
| GET | `/api/demo/analyze` | autenticado | analisar modelo demo |
| GET | `/api/demo/export-excel` | autenticado | exportar demo para XLSX |
| GET/POST/PATCH/DELETE | `/api/admin/users...` | administrador | gestão de usuários |

## 8. Padrões e convenções observados

- Frontend em TypeScript, com componentes funcionais, hooks nativos e ícones de `lucide-react`.
- Comunicação HTTP isolada em `frontend/src/api.ts`; tipos de payload centralizados em `frontend/src/types.ts`.
- CSS centralizado em `frontend/src/styles.css`; o projeto geralmente evita estilos inline. Uma exceção existente é a posição calculada do menu de filtro da tabela.
- Backend organizado por responsabilidade: rotas/composição em `main.py`, autenticação, validações e serviços puros de análise, comparação e Excel.
- Mensagens de interface e domínio estão em português.
- Dados sensíveis não devem ser versionados: `.env`, tokens, senhas e bancos SQLite locais são excluídos conforme o README.

## 9. Deploy

- O build do frontend executa TypeScript, Vite e `scripts/create-sites-worker.mjs`.
- O script gera `dist/server/index.js`, inlinando os assets do build e servindo a SPA por um worker do Sites.
- Rotas `/api/*` são proxy para a API configurada em `LEITORBI_API_URL` ou `VITE_API_URL` no ambiente de hospedagem.
- Sem essa variável na hospedagem, o worker responde `503` para a API e informa a configuração ausente.
- Para produção, configurar `LEITORBI_CORS_ORIGINS`, `VITE_API_URL`/`LEITORBI_API_URL` e `LEITORBI_SESSION_SECURE=true` em HTTPS.

## 10. Qualidade e testes

- O backend possui testes para análise da demo, exclusão de tabelas técnicas, comparação, Excel, upload, CORS/origem, observabilidade, autenticação e gestão de usuários.
- O frontend possui testes dos fluxos de landing, demo pública, login, registro, redirecionamentos, upload, gestão de usuários e comparação tolerante a payload parcial.
- Não foi executada uma suíte nesta atualização documental; o estado descrito acima vem da inspeção do código e do histórico do repositório.

## 11. Pontos de atenção conhecidos

- `frontend/src/App.tsx` concentra grande parte das telas, componentes internos e estado da aplicação; uma evolução futura pode extrair domínios em componentes/hooks menores.
- O rate limit de login é mantido em memória. Em múltiplas instâncias de backend, ele não é compartilhado e é reiniciado quando o processo reinicia.
- A persistência de usuários/sessões é SQLite local. Uma estratégia de banco gerenciado deverá ser definida antes de uma implantação horizontal ou de maior escala.
- O projeto usa texto com codificação inconsistentes em alguns arquivos/saídas exibidas no ambiente; ao editar mensagens em português, preservar UTF-8 para evitar regressões de acentuação.

## 12. Próximos passos sugeridos (não implementados)

1. Validar o fluxo completo de deploy: frontend Sites, proxy `/api`, CORS e cookie seguro em domínio HTTPS real.
2. Definir a estratégia de persistência e rate limiting para produção, caso o projeto tenha mais de uma instância ou público maior.
3. Modularizar gradualmente `App.tsx` ao adicionar novas funcionalidades, preservando os testes existentes.
4. Manter este arquivo atualizado a cada entrega relevante, principalmente quando houver mudança de contratos de API, autenticação, deploy ou formato de export aceito.

## 13. Histórico resumido de decisões

| Data/commit | Mudança |
| --- | --- |
| 2026-07-09 (histórico) | Testes frontend, separação de rotas públicas/área autenticada, validações de upload e proteção de CORS/origem foram incorporados. |
| 2026-07-09 (histórico) | Landing/login foram refatorados e adicionou-se gestão administrativa e cadastro de usuários. |
| 2026-07-11 — `699840c`, `1515422`, `babd70c` | O frontend foi preparado para hospedagem em Sites: SPA servida por worker, proxy de API e correção de assets inlinados. |
| 2026-07-11 | Criação deste `AI_CONTEXT.md` a partir do estado atual do repositório. |

## 14. Checklist para futuras IAs

Antes de mudar o projeto:

- Verificar se a alteração afeta as três experiências: landing pública, demo pública e workspace autenticado.
- Em mudanças de endpoint, atualizar `backend/app/main.py`, os schemas e `frontend/src/api.ts`/`types.ts` de forma coerente.
- Em operações mutáveis, confirmar compatibilidade com validação de origem e cookies.
- Para arquivos enviados, manter validações alinhadas entre frontend e backend.
- Executar `pytest` no backend e `npm test` + `npm run build` no frontend quando a alteração tocar essas camadas.
- Atualizar este documento com decisões e funcionalidades relevantes concluídas.
