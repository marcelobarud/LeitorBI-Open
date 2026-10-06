# LeitorBI Open — Roadmap de Enriquecimento Semântico

**Status:** Auditado / Não iniciado
**Data da auditoria:** 2026-10-03
**Baseline:** Fase A de paridade JSON × TMSL × TMDL concluída e commitada.

Este documento consolida a auditoria da Fase B e as decisões de escopo para uma evolução futura. Nenhuma funcionalidade da Fase B foi implementada. As prioridades podem ser revistas quando houver novos modelos reais para validação.

## Objetivo e princípios

A futura Fase B poderá ampliar a capacidade analítica do LeitorBI Open aproveitando informações semânticas já disponíveis nos modelos Power BI, sem transformar metadata técnica ou heurísticas frágeis em conclusões sobre a qualidade do modelo.

- Preferir dados objetivos e separar explicitamente fatos de inferências.
- Evitar falsos positivos e preservar a segurança dos arquivos analisados.
- Manter JSON, TMSL e TMDL semanticamente alinhados.
- Não depender de PBIP quando a mesma informação já estiver disponível no JSON.
- Incorporar metadata exclusiva do PBIP somente quando houver valor claro para o usuário.
- Preservar os fluxos atuais de análise, comparação e exportação.

## Baseline após a Fase A

JSON PBIModelExport, TMSL e TMDL passam por um modelo canônico compartilhado. Diferenças de serialização não devem aparecer como mudanças semânticas; `Unknown` não equivale automaticamente a `Modified`. DAX e M são preservados, as fontes usam um detector comum, propriedades omitidas seguem somente defaults documentados e a proveniência distingue valores `explicit`, `default`, `inferred` e `unknown`.

A aceitação real v32 × v33 registrou:
- `Data Dictionary` removida;
- `dbo_Tkscale (FATO)` modificada pela nova etapa `Table.Distinct` na expressão M;
- zero colunas modificadas artificialmente;
- zero medidas modificadas;
- zero relacionamentos modificados.

Esse baseline não deve ser reaberto nem alterado pelas futuras fases de enriquecimento.

## Amostras e limites da auditoria

A principal amostra foi `Logistica de Patio v33.SemanticModel.zip`; `Logistica de Patio v32_ModelExport.json` foi usado como referência. Os arquivos reais permaneceram fora do repositório e não devem ser versionados.

No PBIP v33 foram observados 107 tabelas, 1.943 colunas, 48 medidas, 107 partições, 103 relacionamentos, 89 hierarquias, 356 níveis, 2.543 `lineageTag` e 2.717 annotations. Esses números descrevem somente as amostras, não uma característica geral de PBIP.

O `cache.abf` não foi aberto nem analisado. A pasta `.Report` não estava presente na amostra e páginas/visuais não foram analisados.

## Três categorias que não devem ser confundidas

### A. Metadata já disponível, mas ainda não utilizada

Inclui `summarizeBy`, `sortByColumn`, `compatibilityLevel` e hierarquias. Parte já existe no modelo canônico; outra parte, como hierarquias, é descartada antes do Analyzer. São candidatos naturais para enriquecimento sem exigir dependência exclusiva de PBIP.

### B. Metadata técnica ou específica do PBIP

Inclui `lineageTag`, annotations, layout do diagrama, DAX Queries, `definition.pbism` e configurações locais. A existência de uma propriedade no arquivo não implica que ela seja útil para análise ou comparação semântica.

### C. Análises derivadas

Inclui tabelas desconectadas, componentes do grafo, dependências DAX, lineage M e profundidade de dependência. São resultados calculados a partir de metadata; devem declarar método, limites e confiança, sem serem apresentados como fatos diretamente extraídos.

## Inventário de capacidades

| Capacidade | JSON | PBIP/TMDL | Na amostra | Uso atual e valor potencial | Limitação principal |
| --- | --- | --- | --- | --- | --- |
| `summarizeBy` | Sim | Sim | Sim | Já está no canônico; útil para inventário de colunas. | Ainda não exposto pelo Analyzer. |
| `sortByColumn` | Sim | Sim | Sim | Já está no canônico; permite revisar ordenação configurada. | Ainda não exposto pelo Analyzer. |
| `compatibilityLevel` | Sim | Sim, em `database.tmdl` | 1601 | Metadata de versão útil para contexto técnico. | O TMDL database é ignorado hoje; não é semântica comparável. |
| Hierarquias e níveis | Sim, no JSON bruto | Sim | 89 hierarquias / 356 níveis | Inventário e comparação de estrutura e ordem. | Na amostra, todas são automáticas de data. |
| Relacionamentos | Sim | Sim | 103 | Endpoints já são analisados; grafo e métricas objetivas podem ser derivados. | Cardinalidades TMDL ausentes ficam desconhecidas. |
| Dependências DAX | Expressões disponíveis | Expressões disponíveis | 48 medidas | Grafo, reutilização e profundidade podem apoiar auditoria. | Regex lexical não comprova dependência real. |
| Lineage M | Expressões disponíveis | Expressões disponíveis | 14 partições M | Agrupamento de origens e referências adicionais. | Parsing de M/SQL, múltiplas origens e segurança. |
| Storage modes | Sim | Sim | Todas em Import | Distribuição de modos é um indicador objetivo. | Não há DirectQuery, Dual ou DirectLake nesta amostra. |
| Partições e refresh policies | Sim, conforme exportador | Sim | Uma por tabela; sem policy encontrada | Inventário de estratégia e quantidade. | Sem partições múltiplas ou incremental refresh observado. |
| Documentação/configuração | Sim | Sim | Cinco tabelas descritas; zero colunas/medidas descritas | Métricas objetivas de presença, ausência e configuração. | Ausência não prova defeito. |
| Culturas/traduções | Cultura no metadata | Arquivos de cultura TMDL | `pt-BR`; `linguisticMetadata` extensa | Resumo de culturas ou traduções explícitas, se encontradas. | A amostra não mostrou traduções convencionais de Caption/Description/DisplayFolder. |
| Calculation groups/items | Depende do exportador | Suportados pelo formato | Não encontrados | Inventário e comparação se modelos reais justificarem. | Exigem novos objetos e parser específico. |
| Field parameters | Estrutura pode estar nas expressões | Estrutura e metadata TMDL | Não identificados | Inventário e verificação estrutural. | Não classificar apenas pelo nome de tabela. |
| Roles / RLS / OLS | O export atual tem campo `roles` | Suportados pelo formato | Lista de roles vazia no JSON; nenhuma role no TMDL | Presença/quantidade e objetos protegidos podem ser úteis. | Expressões de segurança são sensíveis. |
| Perspectives | Depende do exportador | Suportadas pelo formato | Não encontradas | Inventário e comparação para modelos que as utilizem. | Sem evidência de demanda na amostra. |
| Annotations | Não presentes no JSON exportado | Sim | 2.717 | Allowlist pode ajudar em identificadores de recursos específicos. | A maioria é técnica; não comparar livremente. |
| `lineageTag` | Não presente no JSON exportado | Sim | 2.543 GUIDs únicos | Diagnóstico técnico muito pontual. | IDs podem ser instáveis e produzir ruído. |
| DAX Queries salvas | Não | Sim | Cinco arquivos `.dax` | Inventário opcional separado. | Não representam a definição semântica do modelo. |
| `diagramLayout` | Não | Sim | Quatro diagramas / 37 nós | Pode apoiar uma visualização do Model view. | Posição/zoom/layout não são semântica. |
| Database e metadata de projeto | Parcial | Sim | `compatibilityLevel`, `definition.pbism`, `.platform` | Contexto técnico limitado. | Não deve ser confundido com propriedades do modelo analisado. |

O reader TMDL atual seleciona `model.tmdl`, `relationships.tmdl` e `tables/*.tmdl`; culturas, database, layout, DAX Queries, cache e outros artefatos não entram no modelo canônico.

## Descobertas da amostra

### Hierarquias

Foram encontradas 89 hierarquias, todas automáticas de data, com níveis nesta ordem:

`Ano → Trimestre → Mês → Dia`

Não foi encontrada hierarquia de negócio. As hierarquias existem tanto no JSON v32 quanto no TMDL v33, mas não são representadas no canônico atual. Devem ser separadas das hierarquias automáticas para não poluir a análise principal.

### Relacionamentos

Foram encontrados 103 relacionamentos no modelo completo. Removendo as tabelas automáticas de data, a análise derivada do grafo não direcionado resulta em 18 nós, 15 arestas, quatro componentes, três tabelas isoladas e um ciclo independente.

Tabela isolada, ciclo, alto grau ou relação bidirecional são características observáveis, não conclusões automáticas de problema. No TMDL v33, as cardinalidades não estavam explícitas; a comparação deve respeitar os valores desconhecidos.

### DAX

As 48 medidas possuem expressões preservadas. Uma sondagem lexical encontrou tokens candidatos a referências entre medidas, mas não há parser robusto que permita declarar todas essas ocorrências como dependências reais. Não concluir que uma medida está sem uso sem conhecer seu consumo em `.Report`.

### M e fontes

Foram observadas 14 partições M completas: dez SQL, duas Excel e duas JSON. O lineage mais profundo é possível, mas deve preservar segurança, grau de confiança e a regra atual de classificar uma origem principal por partição. Qualquer referência adicional deve ser aditiva.

### Storage e partições

Na amostra, todas as partições estão em Import; não há DirectQuery, Dual, DirectLake, tabela híbrida, múltiplas partições ou refresh policy observada. Isso descreve somente o modelo real analisado e não limita a capacidade do formato.

## Decisões consolidadas

1. **Ordem de prioridade:** primeiro campos já disponíveis, métricas objetivas e inventário determinístico; depois lineage, grafos e heurísticas.
2. **Hierarquias automáticas:** preservar tecnicamente, separar de hierarquias de negócio e manter fora da análise principal. Um inventário técnico opcional poderá ser considerado.
3. **Comparação:** hierarquias e propriedades de relacionamento só podem gerar mudança quando conhecidas semanticamente. Preservar `Unknown != Modified`; valores conhecidos e diferentes continuam sendo alteração.
4. **Roles/RLS/OLS:** na primeira evolução, limitar a presença, quantidade e, se necessário, objetos afetados. Não exibir filtros ou expressões de segurança completas por padrão.
5. **Interface:** priorizar inventários, tabelas e diagnósticos objetivos antes de grafos complexos. Um grafo só deve avançar quando seus dados subjacentes forem confiáveis.
6. **Fora da comparação semântica principal:** `.Report`, `cache.abf`, layout do diagrama, DAX Queries, configurações locais, `lineageTag` arbitrário, annotations arbitrárias e dados de amostra (`dataHead`).

## Princípios para diagnósticos

Esta linha de evolução não deve criar automaticamente um health score nem declarar um modelo bom ou ruim com base apenas em metadata. Também não deve tratar tabelas desconectadas, relações bidirecionais, M:M ou ciclos como erro automático, nem inferir tabela fato/dimensão apenas pelo nome ou grau. Não declarar medida não usada sem conhecer seu consumo em `.Report`.

Quando não houver evidência objetiva suficiente, preferir os termos “observação”, “característica”, “configuração” ou “diagnóstico” em vez de “erro”, “problema” ou “má prática”.

## Segurança

| Nível conceitual | Exemplos | Diretriz |
| --- | --- | --- |
| Baixo | Contagens, flags e métricas agregadas | Preferir para resumos e indicadores. |
| Médio | Nomes, descrições e hierarquias | Tratar como vocabulário e estrutura de negócio. |
| Médio/alto | DAX, annotations e metadata técnica | Evitar exposição ampla e preservar contexto de origem. |
| Alto | M, SQL, servidores, bancos, URLs, caminhos, RLS/OLS, configurações locais, cache e `dataHead` | Não exibir conteúdo bruto por padrão; proteger e redigir quando houver caso de uso aprovado. |

Novas funcionalidades devem preferir resumos agregados. O conteúdo sensível bruto não deve ser exibido por padrão.

## Custo e impacto de performance

- **Baixo custo esperado:** `summarizeBy`, `sortByColumn`, `compatibilityLevel`, contagens objetivas e hierarquias.
- **Custo médio:** dependências DAX e lineage M, principalmente pela necessidade de validar interpretações.
- **Médio/alto:** leitura integral da cultura/`linguisticMetadata`; limitar a resumos se houver caso de uso claro.
- **Fora de escopo:** `cache.abf`.

Para DAX e lineage, o principal risco é a confiabilidade da análise, não necessariamente o volume de dados.

## Priorização P1–P4

### P1 — Enriquecimento objetivo e de baixo custo

- Expor `summarizeBy`, `sortByColumn` e `compatibilityLevel` onde forem compatíveis com a análise atual.
- Adicionar métricas objetivas de documentação e configuração, sem score de saúde.
- Justificativa: campos já disponíveis ou simples de recuperar, baixo risco de falso positivo e baixo impacto no payload.

### P2 — Estrutura semântica e dependências

- Hierarquias de negócio, com separação das automáticas.
- Análise estrutural objetiva de relacionamentos.
- Dependências DAX e lineage M incremental.
- Justificativa: valor relevante, mas requer definição de confiança, tratamento de metadata desconhecida e validação além de regex simples.

### P3 — Objetos avançados e recursos auxiliares

- Roles/RLS/OLS, perspectives, calculation groups, field parameters e culturas/traduções.
- DAX Queries somente como inventário opcional e layout como reconstrução visual separada.
- Justificativa: capacidade possível, mas não observada ou sem caso de uso suficiente na amostra atual; exige modelos reais de validação.

### P4 — Não recomendado para comparação semântica

- `lineageTag`, annotations irrestritas, posição/zoom/layout, DAX Queries na comparação semântica, cache, `dataHead` e configurações locais. Um inventário opcional de consultas continua sendo apenas uma possibilidade P3.
- Justificativa: metadata instável/técnica, risco de exposição ou ausência de significado semântico para comparação.

## Roadmap futuro de referência

Esta sequência registra possibilidades e decisões de planejamento. **Não autoriza nem inicia implementação de B1, B2, B3, B4 ou B5.**

Sequência de referência: **B1 → B2 → B3 → B4 → B5**.

### B1 — Enriquecimento objetivo

Adicionar campos e métricas já disponíveis com pouca ou nenhuma inferência: `summarizeBy`, `sortByColumn`, `compatibilityLevel` e indicadores objetivos de documentação/configuração.

### B2 — Estrutura semântica

Representar hierarquias de negócio, análise objetiva de relacionamentos, comparação de hierarquias e distinção entre objetos técnicos e objetos de negócio.

### B3 — Dependências

Começar por dependências entre medidas DAX; posteriormente, avaliar lineage M aditivo. Exigir estratégia mais robusta que regex simples e preservar a regra de origem principal por partição.

### B4 — Objetos avançados

Avaliar roles, RLS/OLS, perspectives, calculation groups, field parameters e culturas/traduções somente com modelos reais que contenham esses objetos.

### B5 — Recursos auxiliares

Avaliar `diagramLayout`, DAX Queries e visualizações de grafo somente se surgir caso de uso claro de produto. Manter esses recursos fora da comparação semântica principal.

## Requisitos para futuras implementações

Antes de iniciar qualquer fase futura:

- usar modelos reais quando possível e fixtures controladas para casos específicos;
- separar dados observados, defaults e inferências;
- manter JSON/TMSL/TMDL semanticamente alinhados e preservar a Fase A;
- não ampliar contratos silenciosamente;
- avaliar segurança e impacto de payload;
- testar análise e comparação, incluindo campos desconhecidos;
- documentar limitações e evitar falsos positivos.

## Fora de escopo desta linha de trabalho

- Leitura direta de PBIX.
- Páginas e visuais do `.Report`.
- Execução de DAX e validação de resultados numéricos de medidas.
- Leitura de `cache.abf` e inspeção de dados de negócio.
- Health score automático ou classificação automática de “modelo ruim”.

## Relação com outros documentos

- [`AI_CONTEXT LEITOR OPEN.md`](../AI_CONTEXT%20LEITOR%20OPEN.md) — estado geral e histórico do projeto.
- [`backend/docs/CANONICAL_EQUIVALENCE.md`](../backend/docs/CANONICAL_EQUIVALENCE.md) — regras de equivalência JSON/TMSL/TMDL.
- [`PRODUCT.md`](../PRODUCT.md) — propósito e limites atuais do produto.
- `docs/SEMANTIC_ENRICHMENT_ROADMAP.md` — auditoria, decisões e roadmap da futura Fase B.

Este roadmap é a referência principal para planejamento de enriquecimento semântico. As prioridades devem ser revistas quando houver novas amostras reais; consultar este documento antes de preparar futuros prompts de implementação.
