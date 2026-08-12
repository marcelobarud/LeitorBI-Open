# LeitorBI Open

Versão web pública e independente do LeitorBI para leitura de modelos Power BI. O produto funciona sem login, cadastro, conta, sessão ou administração de usuários.

## O que está disponível

- Landing Page com **Iniciar**, **Como usar** e **Ver Demonstração**.
- Workspace público em `/app` para upload e análise de JSON Power BI.
- Tutorial, resumo, Tabelas, Colunas, Medidas, Fontes e Relacionamentos.
- Filtros, buscas, paginação, expansão de conteúdo e análise de DAX.
- Comparação de dois modelos em `/api/models/compare`.
- Exportação Excel em `/api/models/export-excel`.
- Demonstração pública em `/demo`.
- Interface inicial em PT-BR. O catálogo `en-US` e a infraestrutura de internacionalização permanecem disponíveis para evolução futura.

## Estrutura

- `backend/`: API FastAPI para validação, análise, comparação e Excel.
- `frontend/`: interface React + TypeScript.

## Como executar

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Por padrão, o frontend chama a API em `http://127.0.0.1:8001`. Para outra API, defina `VITE_API_URL`.

## Configuração e segurança

- `LEITORBI_CORS_ORIGINS`: origens permitidas separadas por vírgula. Em produção, deve ser explícito; `*` pode ser usado sozinho quando a implantação realmente exigir acesso aberto.
- `LEITORBI_REQUIRE_ORIGIN`: quando `true`, exige `Origin` ou `Referer` permitido nas operações mutáveis também fora de produção.
- `LEITORBI_MAX_UPLOAD_MB`: limite de upload. Padrão: `10`.
- `VITE_API_URL`: URL base da API no frontend.

A API mantém validação estrutural do JSON, limite de tamanho, leitura segura de arquivos, CORS, Request ID, observabilidade, tratamento de erros e validação de origem. Não há banco SQLite de usuários/sessões nem cookies de sessão.

## Endpoints públicos

- `GET /api/health`
- `GET /api/public/demo/analyze`
- `POST /api/models/analyze` — campo multipart `file`
- `POST /api/models/compare` — campos multipart `base` e `novo`
- `POST /api/models/export-excel` — campo multipart `file`

## Testes e build

Frontend:

```powershell
cd frontend
npm test
npm run build
```

Backend:

```powershell
cd backend
pytest
```

Os testes cobrem análise, comparação, exportação, upload, segurança/origem, observabilidade e fluxo público do frontend.

## Decisões desta versão Open

- Removidos login, cadastro, logout, sessão, cookies de sessão, administração, endpoints de usuários, criação automática de administrador, SQLite de autenticação, rate limit de login e componentes/testes exclusivos desses fluxos.
- Preservados os contratos de análise, comparação e exportação; a dependência de sessão foi retirada.
- O rótulo visual **Relações** foi corrigido para **Relacionamentos** sem alterar o contrato interno `relationships`.
- O fluxo principal passou a ser `Landing → Iniciar → /app`.

## Pendências fora do escopo

- Tradução completa da interface para inglês.
- Persistência de relatórios, uploads, filtros ou histórico.
- Estratégia de escala horizontal e rate limiting geral da API pública.
