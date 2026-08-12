# AI Context — LeitorBI-Web Open

Contexto mantido por inspeção direta do repositório. Esta pasta é a cópia pública independente; o projeto original está em outro diretório e não faz parte das alterações deste Goal.

## Produto e fluxo

O LeitorBI-Web Open transforma exports JSON de modelos Power BI em uma leitura navegável. A Landing Page (`/`) oferece **Iniciar**, **Como usar** e **Ver Demonstração**. Iniciar abre diretamente o workspace público (`/app`), sem autenticação. A demonstração (`/demo`) usa o modelo de exemplo do repositório em modo somente leitura.

O workspace mantém as áreas Início, Tutorial, Tabelas, Colunas, Medidas, Fontes, Relacionamentos e Comparar. O texto exibido ao usuário é **Relacionamentos**; o contrato técnico continua usando `relationships`.

## Funcionalidades preservadas

- Validação de extensão, UTF-8, sintaxe, estrutura e tamanho dos uploads.
- Análise do modelo em resumo, tabelas, colunas, medidas, fontes, relacionamentos e colunas usadas em medidas.
- Detecção de fontes a partir das expressões M e análise de referências DAX.
- Filtros, buscas, paginação, expansão de conteúdo e tratamento de erros.
- Comparação de tabelas, colunas, medidas e relacionamentos, incluindo medidas adicionadas, removidas e modificadas com DAX antes/depois.
- Exportação Excel, quando usada a análise carregada no workspace.
- Demonstração pública, Request ID, logs, CORS, validação de origem e demais validações gerais que não dependem de usuários.
- Catálogos `pt-BR` e `en-US`, `LocaleProvider`, tipos de tradução e infraestrutura de internacionalização.

## Removido para o Open

Foram removidos código, rotas, componentes e testes exclusivos de login, cadastro, logout, autenticação, sessão, cookies de sessão, administração e gerenciamento de usuários. Também foram removidos a criação automática de administrador, o SQLite de usuários/sessões, o rate limit específico de login, as variáveis de ambiente de autenticação e os endpoints `/api/auth/*`, `/api/admin/*` e as cópias de demo que exigiam sessão.

Os endpoints necessários ao produto são públicos:

| Método | Rota | Finalidade |
| --- | --- | --- |
| GET | `/api/health` | Saúde da API |
| GET | `/api/public/demo/analyze` | Relatório do modelo de demonstração |
| POST | `/api/models/analyze` | Análise do campo multipart `file` |
| POST | `/api/models/compare` | Comparação dos campos multipart `base` e `novo` |
| POST | `/api/models/export-excel` | Exportação do campo multipart `file` |

Não há dependência de cookie ou sessão nesses contratos.

## Arquitetura atual

- Frontend: React 19, TypeScript, Vite, Lucide, Vitest e Testing Library.
- Backend: FastAPI, Pydantic, Uvicorn, python-multipart, openpyxl e pytest.
- Roteamento frontend manual via History API para `/`, `/demo` e `/app`.
- `src/api.ts` centraliza chamadas públicas e não envia credenciais de sessão.
- `backend/app/main.py` aplica CORS, validação de origem, observabilidade e endpoints públicos.
- `backend/app/services/` contém os algoritmos de análise, comparação e Excel preservados.
- `backend/app/auth.py` não existe nesta versão.

## Idioma

A experiência inicial é PT-BR, inclusive quando o navegador ou um valor antigo do `localStorage` indicar outro idioma. A troca de idioma foi ocultada para manter o produto público inicialmente apenas em PT-BR, mas os catálogos e a API de localização continuam prontos para reativação futura. Nomes de tabelas, colunas, medidas, modelos, DAX, M e demais dados do modelo não são traduzidos.

## Segurança e operação

Continuam ativos limite de upload, validação estrutural, leitura incremental segura, CORS, Request ID, logs e validação de `Origin`/`Referer` para operações mutáveis. Em produção, `LEITORBI_CORS_ORIGINS` deve ser configurado explicitamente. `LEITORBI_REQUIRE_ORIGIN=true` aplica a exigência de origem fora de produção.

Não existe persistência de usuários, sessões, relatórios, uploads, comparações, filtros ou histórico.

## Validação

Testes frontend cobrem Landing pública, navegação Iniciar, demo pública, análise sem sessão, rótulo Relacionamentos e bloqueio de upload inválido. Testes backend cobrem análise, tabelas técnicas, comparação, Excel, upload, segurança/origem, observabilidade e chamadas públicas sem cookies.

Comandos:

```powershell
cd frontend; npm test; npm run build
cd backend; pytest
```

## Fora do escopo

Completar o catálogo inglês, adicionar persistência/histórico, criar contas ou controles administrativos, introduzir rate limiting geral da API pública e alterar os algoritmos de análise/comparação não fazem parte desta transformação.
