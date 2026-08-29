# LeitorBI Open

Versão web pública e independente do LeitorBI para leitura de modelos Power BI. O produto funciona sem login, cadastro, conta, sessão ou administração de usuários.

## O que está disponível

- Landing Page com **Iniciar**, **Como usar** e **Ver Demonstração**.
- Workspace público em `/app` para upload e análise de JSON Power BI ou ZIP de projeto PBIP com modelo TMSL ou TMDL.
- Tutorial, resumo, Tabelas, Colunas, Medidas, Fontes e Relacionamentos.
- Filtros, buscas, paginação, expansão de conteúdo e análise de DAX.
- Comparação de dois modelos em `/api/models/compare`.
- Exportação Excel em `/api/models/export-excel`.
- Demonstração pública em `/demo`.
- Interface inicial em PT-BR. O catálogo `en-US` e a infraestrutura de internacionalização permanecem disponíveis para evolução futura.

## Estrutura

- `backend/`: API FastAPI para validação, ingestão JSON/PBIP (TMSL/TMDL), análise, comparação e Excel.
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
- `LEITORBI_MAX_PBIP_UPLOAD_MB`: limite do ZIP PBIP. Padrão: `100`.
- `LEITORBI_ENABLE_DOCS`: habilita Swagger/ReDoc; em produção, manter `false`.
- `LEITORBI_TRUST_PROXY_HEADERS`: usa o primeiro endereço de `X-Forwarded-For` para identificar o cliente atrás de um proxy confiável.
- `VITE_API_URL`: URL base da API no frontend.

A API mantém validação estrutural do JSON, validação de ZIP PBIP contra traversal, arquivos aninhados e descompactação abusiva, limite de tamanho, leitura incremental do upload, leitura segura de arquivos, CORS, Request ID, observabilidade, tratamento de erros, validação de origem, headers básicos de segurança e rate limiting público por rota. O PBIP detecta automaticamente `model.bim`/TMSL ou `definition/`/TMDL e normaliza ambos para o mesmo relatório lógico. `cache.abf`, a pasta `.Report`, layouts, visuais e demais artefatos sem equivalente na análise atual são ignorados. Não há banco SQLite de usuários/sessões nem cookies de sessão.

## Endpoints públicos

- `GET /api/health`
- `GET /api/public/demo/analyze`
- `POST /api/models/analyze` — campo multipart `file` (`.json` ou `.zip` PBIP)
- `POST /api/models/compare` — campos multipart `base` e `novo` (`.json` ou `.zip` PBIP)
- `POST /api/models/export-excel` — campo multipart `file` (`.json` ou `.zip` PBIP)

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

Os testes cobrem análise, comparação, exportação, upload, segurança/origem, observabilidade, TMSL/TMDL e fluxo público do frontend. Na validação desta etapa: backend `45 passed`, frontend `27 passed` e build frontend concluído; a compilação Python e `git diff --check` também passaram.

## Decisões desta versão Open

- Removidos login, cadastro, logout, sessão, cookies de sessão, administração, endpoints de usuários, criação automática de administrador, SQLite de autenticação, rate limit de login e componentes/testes exclusivos desses fluxos.
- Preservados os contratos de análise, comparação e exportação; a dependência de sessão foi retirada.
- O rótulo visual **Relações** foi corrigido para **Relacionamentos** sem alterar o contrato interno `relationships`.
- O fluxo principal passou a ser `Landing → Iniciar → /app`.
- O fluxo de entrada aceita o JSON atual e ZIPs de projetos PBIP com `model.bim`/TMSL ou `definition/`/TMDL, normalizados para o mesmo relatório lógico.
- A ingestão TMDL usa tokenização estrutural por linhas, indentação e blocos fenced, seguida de normalização isolada; não usa uma regex única para gerar o payload final.
- Análise, comparação TMDL × TMDL, TMSL × TMDL e JSON × TMDL e exportação Excel reutilizam os contratos e serviços existentes.
- O limite padrão do JSON permanece em 10 MB; o limite do ZIP PBIP é 100 MB compactados e o teto descompactado permanece explícito em 100 MB. Render/proxies externos não são configurados pelo repositório e devem aceitar esse tamanho na implantação.

## Pendências fora do escopo

- Tradução completa da interface para inglês.
- Persistência de relatórios, uploads, filtros ou histórico.
- Estratégia de escala horizontal e rate limiting distribuído entre múltiplas instâncias.
- Recursos TMDL sem equivalente no modelo canônico atual permanecem fora do escopo.
