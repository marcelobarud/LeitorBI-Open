# AI Context — LeitorBI Web

> Estado documentado por inspeção direta do repositório em 13 de julho de 2026. Fatos, limitações e sugestões são separados deliberadamente. O arquivo de contexto existente no repositório chama-se `AI_CONTEXT LEITOR.md`.

## 1. Visão geral

O LeitorBI Web é uma aplicação web para transformar um export JSON de um modelo Power BI em uma leitura navegável. Ele reduz a necessidade de interpretar o JSON diretamente, organizando inventário técnico, fontes, DAX, relacionamentos, alterações entre versões e uma exportação para Excel.

O público principal são pessoas que precisam revisar, auditar, explicar ou compartilhar a estrutura de modelos Power BI. Há três experiências: a landing page pública (`/`), a demonstração pública e somente leitura (`/demo`) e o workspace autenticado (`/app`).

## 2. Estado atual do produto

### Autenticação

- Cadastro público de usuários comuns, login, consulta da sessão atual e logout.
- Sessão baseada em cookie HTTP-only, com duração de 8 horas.
- Visitantes são redirecionados de `/app` para a landing; usuários autenticados são redirecionados de `/` e `/demo` para `/app`.
- O primeiro administrador pode ser criado no startup por variáveis de ambiente, somente se ainda não existir.

### Usuários e administração

- Administradores podem listar, criar, promover/remover privilégio de administrador, desativar/reativar e remover usuários.
- O usuário atual não pode desativar, remover ou retirar o próprio privilégio administrativo.
- A API impede que a última conta administrativa ativa seja desativada, rebaixada ou removida; usa transação SQLite `BEGIN IMMEDIATE` nessas mutações.

### Análise de modelos

- Upload autenticado de JSON do modelo e análise em resumo, tabelas, colunas, medidas, fontes, relacionamentos e colunas usadas em medidas.
- O resumo mostra metadados do modelo, contagens, fontes detectadas e relacionamentos.
- Tabelas técnicas de data (`LocalDateTable` e `DateTableTemplate`) são excluídas da leitura. Tabelas ocultas/automáticas continuam relevantes em partes do relatório, mas são excluídas da contagem de tabelas físicas visíveis e das fontes físicas.
- Fontes são inferidas a partir das expressões M das partições; há regras para SQL, Azure, Fabric/OneLake, arquivos, serviços e outros conectores.
- O DAX de medidas é listado como dado do modelo, e colunas referenciadas em DAX são detectadas por padrões de referência de tabela/coluna.

### Comparação

- Compara dois exports autenticados por tabelas, colunas, medidas e relacionamentos.
- Para tabelas, mostra itens adicionados/removidos e um resumo de alterações de colunas e medidas.
- Para colunas modificadas, compara tipo, tipo de coluna, visibilidade, formato e descrição. Para relacionamentos, compara cardinalidades, direção do filtro e estado ativo.
- Para medidas adicionadas/removidas, a API retorna `expressao_dax`; a expansão mostra somente esse DAX. Para medidas modificadas, a API retorna `antes` e `depois`, exibidos separadamente.
- O frontend normaliza payloads parciais de comparação e usa uma barreira de erro para evitar que um resultado malformado deixe a aplicação em branco.

### Filtros, buscas e detalhamento

- As tabelas de análise têm busca global com debounce de 180 ms, filtros de valores por coluna, busca nas opções do filtro, limite de 120 valores no menu, paginação de 250 registros e expansão de linhas com conteúdo longo, quebra de linha ou `#(lf)`.
- Cada uma das 12 categorias da comparação possui busca própria, filtro próprio por título de item, busca dentro das opções e expansão individual de detalhes. A lista renderiza no máximo os primeiros 80 resultados filtrados.
- O menu de filtro da comparação é renderizado em portal no `document.body`; calcula posição horizontal e abre acima do botão se não houver altura estimada na viewport. Fecha em clique externo, `Escape` ou redimensionamento.
- O menu dos filtros das tabelas é posicionado por coordenadas de viewport, mas não usa portal nem lógica de abertura acima do botão.
- Ao alterar busca ou filtro em uma categoria da comparação, o estado das demais categorias não é compartilhado nem apagado. O botão **Desfazer comparação** limpa arquivos, resultado, carregamento e erro da comparação; não navega para outra rota nem preserva esse estado após o clique.

### Exportação

- A análise de um JSON autenticado pode ser baixada como `.xlsx`.
- O Excel inclui as abas `Resumo`, `Tabelas`, `Colunas`, `Medidas`, `Fontes`, `Relacionamentos` e `Colunas em Medidas`; aplica cabeçalho, bordas, quebra de linha, filtro automático e congelamento da primeira linha.
- A exportação recompõe o relatório no backend a partir do arquivo enviado; ela não recebe filtros, busca, aba atual ou estado visual do frontend.

### Demonstração pública

- `/demo` consulta `/api/public/demo/analyze` e apresenta um JSON de exemplo do repositório em modo somente leitura.
- A demonstração permite navegar pelo resumo e pelas categorias de dados, mas não oferece upload, exportação ou comparação. O login permanece disponível para entrar no app.

### Internacionalização

- Há suporte parcial a `pt-BR` e `en-US` pelo `LocaleProvider`.
- A preferência é salva em `localStorage` com a chave `leitorbi.locale`; sem valor salvo, qualquer idioma do navegador iniciado por `pt` seleciona `pt-BR`, e os demais selecionam `en-US`.
- O seletor é um botão com bandeira CSS do Brasil ou dos Estados Unidos. Ele alterna diretamente entre os dois idiomas e atualiza `document.documentElement.lang`.
- A landing possui um conjunto próprio de chaves tipadas. Partes do workspace, tabelas, login, administração e comparação usam uma tabela de equivalências textual (`tr`).
- Não há arquivos de tradução separados, biblioteca de i18n, contexto de mensagens do backend ou testes específicos de idioma. Diversos textos estáticos, placeholders e conteúdo do tutorial/landing continuam em português; os rótulos e dados reais do modelo não possuem um contrato de tradução.

### Segurança e operação

- Senhas usam `scrypt` com salt; a sessão armazena no banco somente o hash SHA-256 do token.
- Há limite em memória de cinco tentativas de login por combinação IP/e-mail em cinco minutos.
- CORS aceita origens explícitas; `*` é rejeitado. Em produção, CORS explícito e cookie seguro são obrigatórios no startup.
- Operações mutáveis verificam `Origin` ou `Referer`; em produção, ou com `LEITORBI_REQUIRE_ORIGIN=true`, a ausência de ambos também é rejeitada.
- Cada requisição recebe/propaga `X-Request-ID` e produz log de método, rota, status, duração e cliente.

## 3. Stack tecnológica

| Área | Tecnologias e versões declaradas |
| --- | --- |
| Frontend | React 19, TypeScript 5.7, Vite 6, `@vitejs/plugin-react` 4.3, Lucide React 0.468 e CSS próprio |
| Backend | Python, FastAPI, Uvicorn, Pydantic, `python-multipart` |
| Persistência | SQLite padrão da biblioteca Python |
| Exportação | openpyxl |
| Testes frontend | Vitest 4.1, Testing Library, user-event, jsdom |
| Testes backend | pytest |
| Build/deploy | `tsc`, Vite e worker JavaScript gerado para Sites |

As dependências do backend não são fixadas por versão em `backend/requirements.txt`.

## 4. Estrutura do projeto

```text
leitorbi_web/
├── AI_CONTEXT LEITOR.md
├── README.md
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── scripts/create-sites-worker.mjs
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       ├── main.tsx
│       ├── routes.ts
│       ├── styles.css
│       ├── types.ts
│       ├── i18n/LocaleProvider.tsx
│       ├── pages/LandingPage.tsx
│       ├── components/
│       │   ├── CompareErrorBoundary.tsx
│       │   ├── CompareFileInput.tsx
│       │   ├── CompareView.tsx
│       │   ├── CompareView.test.tsx
│       │   ├── DataTable.tsx
│       │   ├── HomeEmptyState.tsx
│       │   ├── LocaleToggle.tsx
│       │   ├── LoginPopover.tsx
│       │   ├── Overview.tsx
│       │   └── UsersAdminView.tsx
│       └── test/setup.ts
├── backend/
│   ├── requirements.txt
│   ├── tests/test_core.py
│   └── app/
│       ├── auth.py
│       ├── demo_data.py
│       ├── main.py
│       ├── observability.py
│       ├── schemas.py
│       ├── security.py
│       ├── upload_validation.py
│       ├── demo/public_demo_model.json
│       └── services/{analyzer.py, compare.py, excel_export.py}
```

Não há hooks customizados, arquivos de idioma separados, assets de bandeira ou providers além de `LocaleProvider`.

## 5. Arquitetura e fluxo

- O roteamento é manual via History API e `popstate`: `/`, `/demo` e `/app`.
- `main.tsx` envolve `App` em `LocaleProvider` e `React.StrictMode`.
- `api.ts` centraliza chamadas `fetch`, usa `credentials: "include"`, envia JSON ou `FormData`, e converte erros de API para mensagens de interface.
- O upload passa por validação no navegador e no backend. O backend valida, instancia `PowerBIAnalyzer` e devolve o contrato `ReportResponse`.
- A comparação mantém os dois arquivos e o resultado no estado de `App`; `CompareView` solicita a API e controla apenas o estado visual por categoria.
- O download solicita novamente a análise ao endpoint de Excel e cria um link temporário no navegador.
- A demo pública usa o mesmo analisador com dados locais de exemplo, porém somente por endpoint público dedicado.
- A preferência de idioma fica apenas no navegador, em `localStorage`; não é enviada à API nem persistida no SQLite.
- No deploy Sites, o worker serve a SPA para caminhos não pertencentes a assets e faz proxy de `/api/*` para `LEITORBI_API_URL` ou `VITE_API_URL` do ambiente.

## 6. Internacionalização

O frontend usa catálogos tipados em `src/i18n/translations/pt-BR.ts` e `src/i18n/translations/en-US.ts`, com tipos em `src/i18n/types.ts`, ponto de exportação em `src/i18n/index.ts` e contexto em `src/i18n/LocaleProvider.tsx`. As chaves são semânticas e o catálogo inglês é tipado contra as chaves de `pt-BR`, impedindo ausência de chaves no build.

`useLocale()` expõe `locale`, `setLocale`, `toggleLocale` e `t(key, params?)`. `t` suporta interpolação (`{{nome}}`) e as duas formas singular/plural separadas por `|`. Erros conhecidos retornados pela API são mapeados centralmente por `translateApiError`; mensagens não reconhecidas continuam como fallback técnico seguro.

A escolha do idioma preserva a regra existente: `localStorage` na chave `leitorbi.locale` tem prioridade; idiomas do navegador iniciados por `pt` usam `pt-BR`; os demais usam `en-US`. A troca atualiza `document.documentElement.lang` sem recarregar ou mudar estado de upload, filtro, busca, paginação ou comparação.

Não existe `TreeWalker`, `interfaceTranslations` ou `tr`: todos os textos de interface passam por `t`, incluindo labels, placeholders, ações, mensagens de estado e atributos acessíveis. Dados de domínio — nomes de arquivos/modelos/tabelas/colunas/medidas, DAX, M, payloads e valores do Power BI — permanecem literais e não são traduzidos.

## 7. Tela de comparação

São renderizadas 12 listas: tabelas, colunas, medidas e relacionamentos, cada uma em estados adicionados, removidos e modificados. O cabeçalho agrega contagens totais nesses três estados.

Cada lista tem sua busca e filtro de títulos independentes. O filtro não altera os itens originais e pode ser limpo no próprio menu; ao ativar **Exibir tudo**, não há uma ação/controle com esse nome no código atual. Portanto, não existe comportamento específico de preservação para um modo “Exibir tudo”; há preservação de busca/filtro enquanto o componente segue montado.

Itens podem ser expandidos. Colunas e relacionamentos exibem campos/alterações; medidas adicionadas/removidas exibem `Medida DAX`; medidas modificadas exibem blocos `Antes` e `Depois`. O botão disponível para retorno é **Desfazer comparação**, que somente reinicia o estado dessa funcionalidade. Não há rota, histórico ou botão “voltar” específico da comparação.

## 8. Endpoints

| Método | Rota | Acesso | Finalidade |
| --- | --- | --- | --- |
| GET | `/api/health` | Público | Retorna estado da API. |
| POST | `/api/auth/register` | Público | Cria usuário comum, sem iniciar sessão. |
| POST | `/api/auth/login` | Público | Valida credenciais e define cookie de sessão. |
| GET | `/api/auth/me` | Sessão válida | Retorna usuário atual. |
| POST | `/api/auth/logout` | Público/sessão opcional | Revoga a sessão apresentada e limpa cookie. |
| GET | `/api/public/demo/analyze` | Público | Retorna relatório do modelo de demonstração. |
| POST | `/api/models/analyze` | Autenticado | Analisa um arquivo no campo multipart `file`. |
| POST | `/api/models/compare` | Autenticado | Compara arquivos multipart `base` e `novo`. |
| POST | `/api/models/export-excel` | Autenticado | Retorna o relatório do `file` como XLSX. |
| GET | `/api/demo/analyze` | Autenticado | Analisa o modelo de demonstração. |
| GET | `/api/demo/export-excel` | Autenticado | Exporta o modelo de demonstração em XLSX. |
| GET | `/api/admin/users` | Administrador | Lista usuários. |
| POST | `/api/admin/users` | Administrador | Cria usuário. |
| PATCH | `/api/admin/users/{user_id}` | Administrador | Altera administração e/ou ativação. |
| DELETE | `/api/admin/users/{user_id}` | Administrador | Remove usuário. |

## 9. Contratos e dados

O upload precisa ser um arquivo com extensão `.json`, UTF-8/UTF-8 BOM e raiz de objeto. `tables` é obrigatório e deve ser lista de objetos com `name` não vazio. `relationships`, se informado, deve ser lista; `modelMetadata`, se informado, deve ser objeto. O limite padrão é 10 MB, configurável.

O analisador consome, quando presentes, `dashboardName`, `modelName`, `exportDate`, `modelMetadata`, `tables` e `relationships`; dentro de tabelas, usa colunas, medidas e partições. Campos opcionais alimentam tipo, descrição, formato, visibilidade, modo, DAX e expressão M. Ausências em campos não estruturais produzem valores vazios ou “não informado”, não uma rejeição.

`ReportResponse` não aceita campos extras e contém `summary`, listas de entidades, `columnsUsedInMeasures` e `raw`. `CompareResponse` também proíbe campos extras e traz os grupos de comparação. A comparação é baseada em nomes: ela não identifica renomeações como a mesma entidade; em geral as reporta como remoção e adição. Tabelas de data técnicas e tabelas `isAutoGenerated` são excluídas da comparação.

## 10. Segurança

- Senhas: `hashlib.scrypt` com salt aleatório; mínimo de 8 caracteres em cadastro/criação.
- Sessões: token aleatório, hash SHA-256 persistido, expiração de 8 horas, revogação no logout e atualização de `last_seen_at`.
- Cookie: `HttpOnly`, `SameSite=Lax`, caminho `/`; `Secure` é obrigatório em produção e segue configuração/ambiente em outros casos.
- CORS: origens HTTP(S) explícitas, sem caminho e sem curinga.
- Origem: `POST`, `PUT`, `PATCH` e `DELETE` validam `Origin` ou `Referer`; produção exige um dos dois.
- Login: cinco falhas por IP/e-mail a cada cinco minutos, em memória.
- Upload: extensão, leitura incremental de 64 KiB, limite de bytes, arquivo vazio, UTF-8, sintaxe JSON e estrutura mínima são validados.
- Administração: depende de sessão com `is_admin` e aplica as invariantes de administrador ativo.

## 11. Persistência

O backend usa SQLite, por padrão em `backend/.data/auth.sqlite3` ou no caminho de `LEITORBI_AUTH_DB`. Há tabelas de `users` e `sessions`, índices de token e usuário, e uma migração simples para a coluna `name`.

Usuários, hashes, sessões, expiração, revogação e último acesso ficam no banco. A preferência de idioma é local (`leitorbi.locale`). Não existe persistência de relatórios, uploads, comparações, filtros, buscas, histórico de análises ou histórico de comparação.

Em múltiplas instâncias, SQLite local e o rate limit em memória não são compartilhados. Esse desenho não é suficiente, sem estratégia adicional, para escala horizontal.

## 12. Exportação

`POST /api/models/export-excel` recebe o arquivo novamente, gera um `BytesIO` com openpyxl e retorna `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. O nome sugerido é `<dashboard>_analise.xlsx`.

O conteúdo é o relatório completo produzido pelo analisador, com até sete abas. O helper interno aceita exportar uma única aba, porém nenhum endpoint ou tela expõe essa seleção. Filtros, buscas, paginação e expansões da UI não são aplicados ao arquivo.

## 13. Deploy e execução

Localmente, o backend é iniciado com `uvicorn app.main:app --reload --port 8000` e o frontend com `npm run dev` na porta 5173. `VITE_API_URL` pode substituir a URL da API; em localhost, o frontend usa a mesma origem com porta 8000.

`npm run build` executa `tsc`, Vite e `scripts/create-sites-worker.mjs`. O script embute JavaScript/CSS gerados no HTML e cria `dist/server/index.js`. O worker:

- responde a `/api/*` por proxy para `LEITORBI_API_URL` ou `VITE_API_URL`;
- devolve 503 se a URL de API não for configurada;
- serve a SPA para rotas de aplicação e mantém cache longo apenas para `/assets/`.

Variáveis relevantes: `LEITORBI_ENV`, `LEITORBI_CORS_ORIGINS`, `LEITORBI_REQUIRE_ORIGIN`, `LEITORBI_SESSION_SECURE`, `LEITORBI_AUTH_DB`, `LEITORBI_ADMIN_EMAIL`, `LEITORBI_ADMIN_PASSWORD`, `LEITORBI_MAX_UPLOAD_MB`, `VITE_API_URL` e, no worker, `LEITORBI_API_URL`. Em produção HTTPS, CORS explícito e `LEITORBI_SESSION_SECURE=true` são obrigatórios.

## 14. Testes

| Camada | Ferramenta | Cobertura observada |
| --- | --- | --- |
| Frontend | Vitest + Testing Library | Landing, demo, login, cadastro, redirecionamentos, upload, erro de upload, usuários, payload parcial de comparação e DAX de medidas na comparação. |
| Backend | pytest | Análise, tabelas técnicas, comparação e contrato, Excel, validação de upload, observabilidade, CORS/origem, configuração de produção, autenticação e invariantes administrativas. |

Comandos: `cd frontend; npm test`, `cd frontend; npm run build` e `cd backend; pytest`. Nesta atualização documental os comandos não foram executados. A última execução registrada nesta conversa, em 11 de julho de 2026, foi `npm.cmd test`: 11 testes frontend aprovados; ela não comprova o estado posterior das alterações não versionadas atuais. Não há teste observado para idioma, seletor de idioma, menus/filtros independentes da comparação, posicionamento na viewport, DataTable ou integração HTTP real.

## 15. Padrões e convenções

- Interface em React com TypeScript estrito; componentes extraídos ficam em `src/components`.
- Estilos são CSS global em `src/styles.css`; ícones usam `lucide-react`.
- Chamadas HTTP ficam em `src/api.ts`; contratos TypeScript em `src/types.ts`; contratos de resposta do backend em `schemas.py`.
- O domínio e a interface são prioritariamente escritos em português do Brasil. O repositório contém acentuação corrompida em arquivos exibidos como `Ã...`; novas edições devem ser gravadas e revisadas em UTF-8.
- Erros são transformados em mensagens de UI; erros de sessão removem o usuário e redirecionam para a landing.
- Nomes, DAX, expressões M, nomes de tabelas/colunas e valores do modelo são dados técnicos e não devem ser traduzidos como texto de interface.

## 16. Pontos de atenção

- `App.tsx` ainda concentra roteamento, sessão, upload, exportação, tutorial e estado do workspace, apesar das extrações recentes.
- A internacionalização é parcial: não há arquivos de tradução, muitas strings não passam por `t`/`tr`, não há cobertura automatizada e a varredura do DOM baseada em texto é frágil.
- A tela de comparação não possui controle chamado “Exibir tudo” nem retorno por rota; documentações ou requisitos que afirmem esses recursos estão desatualizados.
- O posicionamento protegido na viewport foi implementado para os filtros da comparação, mas não para todos os menus suspensos da aplicação.
- A UI limita resultados de comparação a 80 e opções de filtro de tabela a 120, o que pode ocultar itens sem paginação alternativa.
- SQLite local, rate limit em memória e preferência somente local impedem escala horizontal consistente.
- Dependências Python sem versões fixas reduzem reprodutibilidade.
- Não foram encontrados `.env.example` nem configuração de deploy do backend; o worker depende de configuração externa da URL da API.
- Há cobertura de comparação DAX, mas faltam testes para alterações recentes de busca/filtro, idioma e menus.

## 17. Próximos passos sugeridos

### Prioridade imediata

1. Corrigir/validar codificação UTF-8 de mensagens e documentação.
2. Cobrir em teste os fluxos recentes de comparação e internacionalização antes de novas evoluções.

### Curto prazo

1. Substituir a tradução por varredura do DOM por chaves explícitas, com arquivos de mensagem por idioma.
2. Completar a tradução de landing, tutorial, workspace, comparação, detalhes e administração, preservando os dados técnicos do modelo.
3. Validar o deploy completo com proxy, CORS, cookies e HTTPS reais.

### Médio prazo

1. Reduzir responsabilidades de `App.tsx` com hooks/containers por domínio.
2. Definir persistência, rate limit e sessão compatíveis com múltiplas instâncias.

### Futuro

1. Definir se análises, comparações e preferências de workspace devem ter histórico persistido.
2. Avaliar detecção de renomeações na comparação, se isso for requisito do produto.

## 18. Histórico recente confirmado

| Commit | Mudança confirmada |
| --- | --- |
| `5d88a69` | Extração de estado vazio, entrada de arquivos e barreira de erro da comparação. |
| `ce36f18` | Isolamento do fluxo de comparação do workspace. |
| `9539593` / `e079512` | Extração de resumo e administração de usuários de `App.tsx`. |
| `3ce571b` | Formalização dos contratos de comparação. |
| `a6f3230` | Busca nas categorias de comparação. |
| `e22e7ce` | Estabilização da interação de filtros de comparação. |
| `1d8e76f` | Inclusão de campos para DAX de medidas adicionadas/removidas. |
| `71cafd2` | Correções de português. |

Há mudanças locais não commitadas na camada de idioma, componentes, `App.tsx` e estilos. Elas foram inspecionadas e documentadas como estado atual do diretório de trabalho, mas não possuem commit confirmado neste histórico.

## 19. Checklist para futuras IAs

- [ ] Inspecionar landing, demo pública e workspace autenticado antes de alterar fluxo visual.
- [ ] Preservar cookie, CORS, validação de origem e proteção administrativa.
- [ ] Manter validação alinhada entre cliente e backend para qualquer upload.
- [ ] Ao mudar comparação, preservar filtros/buscas por categoria e detalhes de DAX `antes`/`depois`.
- [ ] Não traduzir nomes, DAX, expressões M ou valores do modelo.
- [ ] Atualizar `pt-BR` e `en-US`, o seletor e `document.documentElement.lang` em mudanças de interface.
- [ ] Revisar os arquivos em UTF-8 e procurar caracteres corrompidos.
- [ ] Atualizar contratos em `api.ts`, `types.ts`, schemas e testes quando endpoints mudarem.
- [ ] Executar `pytest`, `npm test` e `npm run build` quando o ambiente permitir.
- [ ] Atualizar este contexto após mudanças relevantes, distinguindo claramente fato de proposta.
