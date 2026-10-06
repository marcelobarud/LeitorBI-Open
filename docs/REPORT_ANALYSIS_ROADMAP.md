# Roadmap de análise da camada `.Report` (PBIR)

**Status:** auditoria concluída; proposta para discussão, sem implementação nesta etapa.

**Base:** amostra real `Logistica de Patio v33` e leitura da arquitetura atual do LeitorBI Open.

## 1. Objetivo e limites

Este documento consolida a avaliação de viabilidade para adicionar ao LeitorBI Open uma análise da camada `.Report` de projetos Power BI PBIP/PBIR. A proposta mantém as duas responsabilidades separadas:

- **Semantic Model:** tabelas, colunas, medidas, fontes, relacionamentos e lógica do modelo.
- **Report:** páginas, visuais, composição, filtros, segmentadores, bookmarks e navegação.

O foco inicial recomendado é ler metadata PBIR e apresentá-la como inventário estrutural. Não faz parte deste roadmap executar DAX, consultar dados reais ou reproduzir o motor de renderização do Power BI.

As afirmações estão marcadas como:

- **Observado:** encontrado na amostra local.
- **Formato:** previsto pela documentação ou pelos schemas públicos do PBIR.
- **Derivado:** avaliação técnica ou oportunidade futura, não comportamento garantido pelo formato.

## 2. Amostra e inventário

**Observado.** A amostra local foi fornecida como três artefatos separados: descritor `.pbip`, ZIP `.Report` e ZIP `.SemanticModel`. A referência relativa `byPath` e os nomes correspondem entre si. Não havia um único ZIP contendo o projeto completo; os artefatos foram tratados como a mesma amostra lógica e não foram reempacotados nem copiados para o repositório.

O `.Report.zip` contém **167 arquivos**, 337 entradas incluindo diretórios, **6.616.399 bytes descompactados** e aproximadamente **5.785.763 bytes compactados**.

| Área | Conteúdo | Arquivos | Bytes descompactados |
|---|---|---:|---:|
| `.pbi/` | `localSettings.json` | 1 | 7.116 |
| raiz | `.platform`, `definition.pbir` | 2 | 572 |
| `definition/` | `report.json`, `version.json` | 2 | 3.454 |
| `definition/pages/` | `pages.json`, 11 `page.json`, 138 `visual.json` | 150 | 681.162 |
| `definition/bookmarks/` | `bookmarks.json`, 2 arquivos de bookmark | 3 | 156.488 |
| `StaticResources/RegisteredResources/` | 6 PNG e 1 JPG | 7 | 5.747.933 |
| `StaticResources/SharedResources/` | 2 recursos JSON de tema | 2 | 19.674 |

Visão da estrutura observada:

```text
<projeto>.Report/
├── .pbi/localSettings.json
├── .platform
├── definition.pbir
├── definition/
│   ├── report.json
│   ├── version.json
│   ├── pages/
│   │   ├── pages.json
│   │   └── <11 páginas>/
│   │       ├── page.json
│   │       └── visuals/<138 containers>/visual.json
│   └── bookmarks/
│       ├── bookmarks.json
│       └── <2 bookmarks>.bookmark.json
└── StaticResources/
    ├── RegisteredResources/ (7 imagens)
    └── SharedResources/ (2 recursos de tema)
```

Não foram encontrados `mobileState.json`, `mobile.json`, `reportExtensions.json`, pasta `CustomVisuals/` ou pacote `.pbiviz`. Esses componentes são opcionais no formato, portanto sua ausência na amostra não representa ausência de suporte PBIR. A estrutura e a separação entre PBIR e PBIR-Legacy estão descritas pela [documentação Microsoft da pasta Report](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report).

O descritor usa PBIR `version` 4.0. Os schemas declarados na amostra incluem report 3.1, page 2.0, visual container 2.5 e bookmark 2.0. Como cada arquivo declara uma versão de schema, o leitor deve tratar versões como metadata de entrada e tolerar evolução do formato. Os arquivos foram lidos como JSON e os schemas relevantes foram consultados; não foi executada validação automatizada de todos os arquivos contra cada schema.

## 3. Evidências por componente

### Relatório

**Observado:** `definition.pbir` referencia o Semantic Model local por `byPath`. `report.json` contém `themeCollection`, objetos de formatação, `resourcePackages` e configurações gerais. Não há filtro global (`filterConfig`) nem nome de exibição do relatório nesse arquivo. Também não há `reportExtensions.json`.

**Formato:** `report.json` pode conter filtros de relatório e metadata de temas e custom visuals. **Derivado:** a ausência de uma propriedade na amostra não deve ser transformada numa regra de que ela nunca existe em outros relatórios. O schema público está disponível no [schema oficial de report](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.1.0/schema.json).

### Páginas

**Observado:** 11 páginas, ordem consistente com as páginas presentes e página ativa `Consistências`. Quatro páginas estão visíveis por padrão e sete usam `HiddenInViewMode`. Oito páginas são 16:9 e três têm canvas vertical 1920×1800 (16:15). As dimensões e posições observadas não extrapolam os limites da página.

| Ordem | Página | Estado | Canvas | Visuais | Filtros | Interações |
|---:|---|---|---:|---:|---:|---:|
| 1 | Capa | Visível | 1920×1080 | 3 | 0 | 0 |
| 2 | Consistências | Visível | 1920×1800 | 31 | 1 | 31 |
| 3 | Tempo Médio | Visível | 1920×1800 | 39 | 2 | 49 |
| 4 | Tempo Médio Dentro da Fábrica | Visível | 1920×1800 | 40 | 2 | 36 |
| 5 | Drill Page | Oculta | 1920×1080 | 6 | 14 | 0 |
| 6 | Teste 1 | Oculta | 1280×720 | 3 | 0 | 0 |
| 7 | Teste 2 | Oculta | 1280×720 | 2 | 0 | 0 |
| 8 | Page 3 | Oculta | 1280×720 | 4 | 0 | 2 |
| 9 | Page 4 | Oculta | 1280×720 | 4 | 0 | 0 |
| 10 | Page 5 | Oculta | 1280×720 | 3 | 0 | 0 |
| 11 | Page 1 | Oculta | 1280×720 | 3 | 1 | 0 |

O `displayName` da página Consistências está armazenado com espaços laterais. A identidade técnica deve permanecer separada do rótulo apresentado na interface. O [schema oficial de page](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json) descreve dimensões, escala, visibilidade, bindings e interações.

### Visuais, títulos e composição

**Observado:** 138 containers, sendo 137 com `visualType` e um `visualGroup`. Todos têm `x`, `y`, `width`, `height` e `z`; 135 têm `tabOrder`. Há cinco containers de visual ocultos, três referências a grupo — todas resolvidas — e um grupo visual. O `z` permite ordenar a sobreposição. O [schema de visual container](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.5.0/schema.json) documenta posição, dimensão, z-order, tabulação, grupo e filtros do visual.

| Tipo técnico | Rótulo sugerido | Qtde. | Páginas em que aparece |
|---|---|---:|---|
| `slicer` | Segmentador | 41 | Page 4, Page 5, Tempo Médio Dentro da Fábrica, Page 1, Page 3, Tempo Médio, Consistências |
| `actionButton` | Botão | 19 | Capa, Tempo Médio Dentro da Fábrica, Drill Page, Tempo Médio, Consistências |
| `cardVisual` | Cartão | 17 | Page 5, Tempo Médio Dentro da Fábrica, Page 1, Tempo Médio, Consistências |
| `tableEx` | Tabela | 16 | Page 4, Page 5, Tempo Médio Dentro da Fábrica, Drill Page, Teste 2, Page 3, Tempo Médio, Consistências, Teste 1 |
| `barChart` | Gráfico de barras | 15 | Tempo Médio Dentro da Fábrica, Page 1, Tempo Médio, Consistências |
| `textbox` | Caixa de texto | 8 | Tempo Médio Dentro da Fábrica, Tempo Médio, Consistências |
| `image` | Imagem | 6 | Tempo Médio Dentro da Fábrica, Tempo Médio, Consistências |
| `shape` | Forma | 6 | Tempo Médio Dentro da Fábrica, Drill Page, Tempo Médio, Consistências |
| `columnChart` | Gráfico de colunas | 3 | Tempo Médio Dentro da Fábrica, Page 3, Consistências |
| `clusteredBarChart` | Barras agrupadas | 2 | Tempo Médio Dentro da Fábrica, Tempo Médio |
| `areaChart` | Gráfico de área | 1 | Tempo Médio |
| `clusteredColumnChart` | Colunas agrupadas | 1 | Tempo Médio |
| `lineChart` | Gráfico de linhas | 1 | Consistências |
| `donutChart` | Gráfico de rosca | 1 | Consistências |
| grupo, sem `visualType` | Grupo visual | 1 | Tempo Médio Dentro da Fábrica |

Os rótulos são traduções sugeridas; preservar o `visualType` original. Outros tipos — como matriz, mapa, KPI, gauge, waterfall ou custom visual — não foram observados. Isso não demonstra que sejam incompatíveis com PBIR.

Há 43 estruturas de título, das quais 23 têm texto explícito; todos esses textos são literais estáticos. Não foi encontrada referência dinâmica no campo de texto do título. Existem oito caixas de texto; interpretar texto rico deve ser tratado como capacidade separada. A metadata inclui objetos de estilo para elementos como contorno, cabeçalho, legenda, rótulos e eixos, mas formatação condicional pode depender de seletores, expressões e dados.

### Campos e ligação ao Semantic Model

**Observado:** os `queryState` incluem 214 projeções nos papéis `Values`, `Data`, `Category`, `Tooltips`, `Y` e `Series`: 130 colunas, 63 medidas, 8 agregações e 13 níveis de hierarquia. A resolução, usando o leitor TMDL já existente, encontrou correspondência direta para **130/130 colunas e 63/63 medidas** no modelo da amostra. O modelo analisado pelo leitor contém 107 tabelas, 1.943 colunas e 48 medidas.

**Derivado:** a ligação direta visual–coluna/medida é forte para impacto futuro. Agregações, hierarquias, field parameters e dependências transitivas de medidas exigem tratamento adicional. Os papéis observados não incluem `Rows`, `Columns` nem `Small multiples`; não se deve generalizar esse inventário para todos os visuais ou versões.

### Filtros, segmentadores e bookmarks

**Filtros observados:** 20 filtros de página, todos `Categorical`; 27 de visual, distribuídos em 14 `Categorical`, 11 `Advanced` e 2 `TopN`. Campos simples podem ser ligados ao modelo; hierarquias, expressões aritméticas e agregações exigem resolução própria.

**Segmentadores observados:** 41 no total; 38 em modo `Dropdown`, 2 `Basic` e 1 `Between`. Trinta e três têm `syncGroup`, agrupados em 13 nomes de sincronização. A seleção pode persistir em estado de bookmark.

**Bookmarks observados:** dois arquivos e dois itens de metadata, sem grupos explícitos. Ambos capturam `Tempo Médio`, estado de filtros e estado de containers visuais. **Formato:** bookmarks podem preservar estado de página, filtros e formatação; valores literais podem conter dados de negócio. Ver [schema oficial de bookmark](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/bookmark/2.0.0/schema.json).

### Interações, drillthrough e navegação

**Interações observadas:** 118 relações em quatro páginas, todas com origem e destino resolvidos para visuais. Os modos são 112 `DataFilter` e 6 `NoFilter`; não há modo `Highlight` explícito. O comportamento padrão pode ficar a cargo do visual, portanto ausência de modo explícito não significa ausência de interação.

**Drillthrough observado:** uma página oculta com binding `Drillthrough` e 14 parâmetros ligados a filtros/campos. Duas outras páginas possuem binding `Default`, que não indica tooltip. Não foi identificada página com binding `Tooltip`. Há configurações de tooltip de visual, incluindo uma referência a medida, mas isso não é tooltip page.

**Navegação observada:** 17 ações `PageNavigation`, 4 `Bookmark`, 3 `ClearAllSlicers` e 1 `Back`. Os 18 destinos de página foram resolvidos. Entre três referências diretas a bookmarks, duas resolveram a IDs da amostra e uma não; registrar como caso a validar, sem declarar que a ação está quebrada.

### Mobile, custom visuals, temas e acessibilidade

- Não foram encontrados arquivos de layout mobile.
- Não foram encontrados custom visuals ou pacotes `.pbiviz`; os recursos observados são imagens e temas.
- Há tema base, tema personalizado, sete imagens (cerca de 5,75 MB) e objetos de background/display em cinco páginas.
- Não foi encontrado `altText` nos JSONs de visual. `tabOrder` está presente em 135 dos 138 containers.

## 4. Viabilidade e limitações da prévia

### Canvas estrutural

**Alta viabilidade.** Coordenadas, dimensões, camadas, tipos, títulos, campos, grupos e visibilidade dão base para desenhar uma página em escala proporcional. Essa prévia pode preservar a disposição; não representa uma renderização do Power BI.

### Representação sintética

| Tipo observado | Dificuldade sugerida | Fallback recomendado |
|---|---|---|
| Cartão, texto, forma, imagem, botão | Fácil | Componentes visuais estáticos; ações desativadas |
| Barras, colunas, linhas e barras agrupadas | Fácil | Formas ilustrativas, sem consulta de dados |
| Tabela | Moderada | Grid com conteúdo artificial |
| Segmentador | Moderada | Controle demonstrativo, sem filtrar outros visuais |
| Área, rosca e colunas agrupadas | Moderada | Geometria e estilo aproximados |
| Grupo visual | Fallback genérico | Contorno/área que represente o agrupamento |
| Tipo não reconhecido ou custom visual | Fallback genérico | Rótulo do tipo e campos conhecidos |

Qualquer dado sintético precisa de aviso persistente como **“ilustrativo — não representa dados do modelo”**. Cartões devem usar placeholders neutros; números aleatórios podem parecer resultados reais.

### Níveis de fidelidade

1. **Estrutural — viável:** posição, tamanho, tipo, título e bindings.
2. **Visual aproximado — parcialmente viável:** cores, background, bordas, orientação e geometria simplificada.
3. **Fidelidade alta — não recomendada inicialmente:** formatação condicional completa, custom visuals, comportamento de runtime, valores e interações reais.

Valores de visuais exigiriam dados e execução do modelo. Resultado de medidas e títulos dinâmicos exigiria execução DAX. Reprodução fiel de visuais e interações exigiria comportamento equivalente ao engine Power BI. Não faz parte deste roadmap executar essas operações.

## 5. Arquitetura futura sugerida

**Observado no código atual:** [`read_model_upload`](../backend/app/ingestion/loader.py) roteia JSON e ZIP; [`read_pbip_archive`](../backend/app/ingestion/pbip_reader.py) procura TMSL/TMDL e devolve o modelo; [`normalize_model`](../backend/app/ingestion/normalization.py) produz a estrutura canônica sem entidades de Report. A resposta Pydantic [`ReportResponse`](../backend/app/schemas.py) proíbe campos extras; análise, comparação e interface operam sobre o modelo.

**Derivado:** preservar o fluxo semântico existente e acrescentar uma projeção opcional independente:

```text
Upload PBIP
  ├── leitor semântico existente → modelo normalizado → análise atual
  └── leitor PBIR futuro          → inventário de Report → área de Report
```

O leitor de Report deve consumir apenas arquivos relevantes para a análise inicial, sem alterar o normalizador TMSL/TMDL nem transformar `.Report` em campos do modelo. A resposta pode ser estendida de forma compatível ou exposta por fluxo separado — decisão de contrato ainda necessária. O Report deve permanecer opcional para projetos que só contenham Semantic Model.

Entidades conceituais candidatas: `Report`, `Page`, `Visual`, `VisualFieldBinding`, `Filter`, `Slicer`, `Bookmark`, `Interaction`, `NavigationAction`, `PageBinding` e `ResourceReference`. Não definir schema final antes de aprovar escopo e política de dados.

## 6. Segurança e desempenho

### Privacidade

| Conteúdo | Risco inicial | Orientação |
|---|---|---|
| Valores de filtros, segmentadores e bookmarks | Alto | Não devolver valores literais por padrão |
| `.pbi/localSettings.json` e `securityBindingsSignature` | Alto | Excluir da resposta, logs e armazenamento de análise |
| Nomes de páginas, campos e configurações | Médio | Tratar como metadata potencialmente interna |
| Imagens, links e texto rico | Médio | Não buscar URLs; sanitizar qualquer renderização de texto |
| Contagens e dimensões | Baixo a médio | Expor somente conforme política do produto |

Na amostra, os filtros e bookmarks contêm valores literais. Não foram identificadas URLs externas nem padrões óbvios de token/credencial nos valores JSON inspecionados, fora das URLs de schema. Isso não constitui certificação de segurança de outros projetos PBIP. A própria documentação Microsoft alerta que metadata de visual/bookmark pode persistir valores do modelo.

### Desempenho

O custo de ler cerca de 6,6 MB de Report descompactado tende a ser baixo a moderado. As imagens somam aproximadamente 5,75 MB e dominam o pacote. O projeto lógico completo da amostra totaliza cerca de 81,3 MB descompactados, abaixo do limite atual de 100 MiB, mas com margem limitada. O limite e a quantidade de arquivos devem ser reavaliados com projetos maiores.

Se hospedado em Render Free, a documentação atual informa 0,1 CPU e 512 MB de RAM para web service gratuito. Isso é suficiente para protótipo, mas parsing concorrente de modelo e Report, buffers e uma prévia pesada podem pressionar memória; medir no ambiente real antes de produção. Ver [planos Render](https://render.com/docs/compute-plans) e [limitações do Free](https://render.com/docs/free).

Recomendações futuras: processar recursos sob demanda, não embutir imagens no JSON da API, carregar somente a página ativa e não renderizar todas as páginas simultaneamente. Adicionar limites para bytes/quantidade/profundidade e tratar propriedades desconhecidas de forma segura. Não buscar dinamicamente `$schema` ou URLs contidas no relatório.

## 7. Priorização e fases propostas

| Prioridade | Capacidades |
|---|---|
| **P1 — alta objetividade** | Manifesto/versão PBIR; páginas, ordem, visibilidade, canvas; visuais, tipo, posição, título; bindings diretos; contagens |
| **P2 — normalização adicional** | Filtros com redaction; modos e sincronização de segmentadores; navegação; interações; drillthrough; inventário de bookmarks |
| **P3 — maior valor/complexidade** | Canvas estrutural; temas e recursos sob demanda; comparação de Report; impacto Semantic Model × Report; acessibilidade |
| **P4 — não recomendado inicialmente** | DAX/dados reais; renderização fiel; custom visuals executáveis; interação real; replay de bookmarks no engine |

Sequência sugerida:

1. **R1 — leitura e inventário seguros:** reconhecer PBIR, validar arquivos e versões, expor contagens sem valores sensíveis.
2. **R2 — páginas e visuais:** ordem, dimensões, visibilidade, tipos, coordenadas, títulos e bindings simples.
3. **R3 — relações de Report:** filtros redigidos, segmentadores, ações, interações, bookmarks e drillthrough.
4. **R4 — canvas estrutural:** prévia estática, página sob demanda, sem valores do modelo.
5. **R5 — cruzamento e comparação:** impacto sobre medidas/colunas e diferenças semânticas versus visuais entre Reports.
6. **R6 — extensão avaliada à parte:** mobile, tooltips, field parameters e suporte mais amplo a recursos/custom visuals.

## 8. Decisões necessárias antes da implementação

1. A primeira entrega cobrirá somente PBIR em `definition/` ou também PBIR-Legacy baseado em `report.json`?
2. A camada Report será opcional, preservando o processamento de projetos sem `.Report`?
3. Valores de filtro/bookmark serão omitidos sempre ou haverá uma visualização técnica protegida?
4. A prévia inicial será apenas estrutural? Caso aceite valores sintéticos, qual aviso visual será obrigatório?
5. Quais limites adicionais de recursos, versões de schema e tamanho serão aceitos?

## 9. Fora de escopo

- Implementar parser, schema, API, frontend, canvas ou testes nesta etapa.
- Executar DAX, consultar dados reais ou abrir caches do modelo.
- Renderizar Power BI fielmente ou executar ações do relatório.
- Incorporar projetos PBIP reais ao repositório.
- Comparar, commitar ou publicar alterações de código.

## 10. Fontes principais

- [Microsoft Learn — estrutura da pasta Report e formato PBIR](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report)
- [Schema oficial de report 3.1](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/3.1.0/schema.json)
- [Schema oficial de page 2.0](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json)
- [Schema oficial de visual container 2.5](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.5.0/schema.json)
- [Schema oficial de bookmark 2.0](https://developer.microsoft.com/json-schemas/fabric/item/report/definition/bookmark/2.0.0/schema.json)
- [Render — planos de computação](https://render.com/docs/compute-plans) e [limitações do Free](https://render.com/docs/free)
