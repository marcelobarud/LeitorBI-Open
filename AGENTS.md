# AGENTS.md — LeitorBI Open

## Objetivo e princípios de trabalho

Produza mudanças corretas, pequenas, verificáveis e compatíveis com o projeto.
Investigue a implementação e os contratos antes de alterações relevantes; preserve
o comportamento fora do escopo e evite refatorações adjacentes, abstrações ou
dependências sem necessidade concreta.

- Separe fatos confirmados, inferências e pontos ainda incertos.
- Use o código e os testes como fonte final para o comportamento implementado.
- Trate documentação como intenção e contexto; investigue divergências relevantes
  antes de decidir qual está correta.
- Reutilize padrões existentes e mantenha compatibilidade, acessibilidade e
  segurança.
- Valide proporcionalmente ao risco. Revise o diff e não declare verificações que
  não foram executadas.

## Fontes de contexto

Consulte os documentos adequados à tarefa sem duplicá-los integralmente aqui:

- `AI_CONTEXT LEITOR OPEN.md`: estado geral, decisões e histórico relevante.
- `PRODUCT.md`: propósito, capacidades, restrições e posicionamento do produto.
- `DESIGN.md`: direção visual e regras de interface, quando a tarefa envolver UI.
- `README.md`: estrutura, execução, configuração, segurança e comandos do projeto.
- `backend/docs/CANONICAL_EQUIVALENCE.md`: equivalência e normalização entre
  JSON, TMSL e TMDL.
- `docs/SEMANTIC_ENRICHMENT_ROADMAP.md`: planejamento futuro de enriquecimento
  do Semantic Model; não autoriza implementação.
- `docs/REPORT_ANALYSIS_ROADMAP.md`: auditoria e planejamento futuro da camada
  PBIR/Report; não autoriza implementação.

Investigue os arquivos-fonte e os testes relacionados à tarefa. A implementação
atual é a fonte final para detalhes técnicos.

## Regras específicas do produto

### Produto e ingestão

LeitorBI Open é uma aplicação pública para análise técnica de modelos Power BI.
As entradas atuais são:

- Projeto PBIP ou pasta `.SemanticModel` compactados em ZIP. O arquivo `.pbip`
  isolado é apenas um descritor e não contém o Semantic Model completo.
- JSON PBIModelExport, que continua totalmente suportado.

PBIP é o fluxo recomendado na interface; JSON PBIModelExport permanece uma
alternativa de primeira classe.

### Semantic Model e comparação

O fluxo atual aceita JSON PBIModelExport, TMSL (`model.bim`) e TMDL/PBIP. Os
readers convergem para o modelo canônico compartilhado antes da análise. Preserve
a normalização, a equivalência e os contratos atuais; não crie análise separada
por formato sem decisão arquitetural explícita.

- `Unknown` não significa automaticamente `Modified`.
- Preserve DAX e M originais para análise e exibição.
- `normalizedExpression` é auxiliar de comparação; não substitui a expressão
  original.
- Preserve proveniência interna (`explicit`, `default`, `inferred`, `unknown`)
  quando aplicável e não a exponha como dado visual sem decisão explícita.
- Antes de alterar readers, normalização ou comparação, consulte
  `backend/docs/CANONICAL_EQUIVALENCE.md` e os testes correspondentes.

### Report/PBIR

A camada `.Report` foi auditada e documentada, mas ainda não está implementada.
Não inicie parser PBIR, canvas, visuais ou análise de Report apenas porque existe
um roadmap. Uma implementação futura precisa de solicitação explícita e deve
consultar `docs/REPORT_ANALYSIS_ROADMAP.md`. Mantenha Semantic Model e Report
como responsabilidades separadas, salvo decisão arquitetural posterior.

### Segurança e dados

Preserve os limites de upload distintos por formato, a validação de ZIP, as
proteções contra traversal, os limites de conteúdo comprimido e descompactado,
CORS, validação de `Origin`/`Referer`, redaction e tratamento de erros existentes.
Não enfraqueça controles de segurança para facilitar ingestão ou diagnóstico.

Não exponha sem necessidade tokens, credenciais, SQL sensível, valores persistidos
de filtros/bookmarks, configurações locais, cache ou dados de negócio. Evite
adicionar esses conteúdos a logs, testes, fixtures ou documentação.

### Frontend e Impeccable

A direção visual vigente é **Caderno de evidências**. Para mudanças pontuais,
preserve identidade, layout e comportamento fora do escopo; reutilize componentes
existentes e mantenha responsividade, acessibilidade, suporte a temas existentes
e i18n.

Não transforme ajustes pequenos em redesign. O projeto usa Impeccable; atualize a
skill somente quando o usuário pedir explicitamente ou autorizar essa atualização.
Se autorizada, preserve-a e não a reverta automaticamente. Atualizar a skill não
autoriza redesenhar a aplicação. Preserve `.codex/hooks.json`, que também pertence
à integração do Impeccable.

## Validação do projeto

Escolha as verificações pelo risco e pelo alcance da mudança, começando por testes
focados quando suficientes.

- Frontend: `cd frontend; npm test`; use a suíte completa quando o impacto
  justificar; execute `npm run build` para mudanças que afetem o produto ou a
  compilação.
- UI: valide visualmente os estados e tamanhos relevantes. Viewports comuns são
  1440×900, 768×1024 e 390×844.
- Backend: `cd backend; pytest` ou os testes focados adequados; use compilação
  Python quando ela contribuir para a verificação.
- Quando aplicável, execute `git diff --check` e revise o diff e o status final.

Não rode todas as verificações mecanicamente em mudanças triviais. Informe o que
foi validado e qualquer limitação relevante.

## Agentes e delegação

Subagentes são opcionais. O Codex principal deve executar diretamente tarefas
pequenas, locais, claras e de baixo risco, como copy, traduções, CSS pontual,
renames e testes simples. Não há pipeline ou sequência obrigatória de agentes.
Delegue somente quando especialização, investigação, revisão independente,
paralelismo ou isolamento de contexto trouxer benefício real.

- **implementer**: implementar uma solução já compreendida, plano aprovado ou
  causa conhecida. Pode editar o workspace, mas não decide sozinho mudanças
  arquiteturais relevantes.
- **planner**: investigar bugs de causa desconhecida e tarefas complexas com
  dependências ou impactos incertos. Somente leitura; entrega diagnóstico e plano
  fundamentados para reduzir incerteza antes da implementação.
- **reviewer**: revisão independente somente quando proporcional ao risco; priorize
  normalização, readers/parsers, comparação, contratos de API, segurança, upload,
  mudanças amplas e Report/PBIR. Somente leitura; não use automaticamente em copy
  ou CSS pequeno.
- **architect**: analisar decisões estruturais reais, como contratos de
  `ReportAnalysis`, limites Semantic Model × Report, modelo canônico, ingestão ou
  compatibilidade pública. Somente leitura; não use apenas porque uma tarefa é
  grande.

Os perfis de projeto configuram somente o `implementer` com `workspace-write`;
`planner`, `reviewer` e `architect` usam `read-only`. O modo de permissão ativo na
sessão Codex ainda pode prevalecer sobre defaults individuais dos perfis.

## Git e operações externas

Mensagens de commit devem ser em PT-BR; prefira Conventional Commits, por exemplo
`feat: adiciona inventário de partições`. Antes de um commit autorizado, revise o
status e o diff e inclua somente os arquivos do grupo correspondente.

Não execute automaticamente `git commit`, push, merge, rebase destrutivo, criação
ou exclusão de tags, deploy, publicação ou ações externas irreversíveis. Um prompt
atual pode autorizar commit explicitamente; essa autorização não inclui push ou
merge. Push exige autorização explícita.
