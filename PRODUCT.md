# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Profissionais de BI, analistas e auditores que precisam revisar modelos do Power BI em situações de documentação, auditoria técnica, comparação de versões e preparação de apresentações.

## Product Purpose

O LeitorBI Open transforma exports JSON de modelos Power BI em uma leitura navegável do modelo. Ele permite analisar um modelo, comparar duas versões e exportar a análise para Excel sem exigir login, cadastro, sessão ou conta. O sucesso é o usuário conseguir sair do export do Power BI para uma compreensão técnica clara do modelo com pouco atrito.

## Positioning

Um workspace público e direto para leitura técnica de modelos Power BI, reunindo inventário, comparação e entrega em Excel no mesmo fluxo, sem a barreira de autenticação da versão original.

## Operating Context

O usuário exporta o modelo a partir do Power BI, normalmente usando o Tabular Editor, e envia o JSON ao LeitorBI Open. A interface é usada para revisar tabelas, colunas, medidas, fontes e relacionamentos, navegar por filtros e buscas, comparar exports entre versões e compartilhar a saída em Excel.

## Capabilities and Constraints

- Landing Page com entrada direta no workspace público.
- Análise de um export JSON de modelo Power BI.
- Comparação entre dois exports JSON.
- Exportação da análise para Excel.
- Demonstração pública com dados de exemplo.
- Áreas do workspace: Início, Tutorial, Tabelas, Colunas, Medidas, Fontes, Relacionamentos e Comparar.
- A interface inicial é PT-BR; a infraestrutura e o catálogo `en-US` devem ser preservados para evolução futura.
- O rótulo visível da área de relacionamentos é `Relacionamentos`; contratos internos podem continuar usando nomes técnicos como `relationships`.
- O fluxo não depende de login, cadastro, sessão, cookies de autenticação, administração ou permissões de usuário.
- Os arquivos enviados são processados pela API e não são persistidos como modelos do usuário.
- O repositório original `LeitorBI-Web` deve permanecer separado e intocado; este contexto vale somente para `LeitorBI-Web Open`.
- O frontend local usa a porta 5174 e a API local usa a porta 8001 durante o desenvolvimento atual.

## Brand Commitments

- Nome atual do produto: **LeitorBI Open**.
- O produto deve comunicar clareza técnica, praticidade e acesso direto ao workspace.
- A versão pública não deve reintroduzir linguagem ou fluxos de login, cadastro, conta ou administração.

## Evidence on Hand

- O repositório local contém a implementação funcional do LeitorBI Open.
- A demonstração pública utiliza dados de exemplo já existentes no projeto.
- A análise e a comparação dependem de exports JSON reais fornecidos pelo usuário; não devem ser inventados dados de clientes, métricas ou depoimentos.
- O projeto está publicado em https://github.com/marcelobarud/LeitorBI-Open.

## Product Principles

- Acesso direto antes de qualquer barreira administrativa.
- Clareza técnica antes de ornamentação visual.
- Preservar os fluxos confiáveis de análise, comparação, demonstração e exportação.
- Diferenciar dados técnicos do modelo de textos de interface.
- Evoluir o Open sem contaminar ou alterar o repositório original.

## Accessibility & Inclusion

A interface deve permanecer navegável por teclado, usar nomes acessíveis para ações e controles, manter contraste legível e comunicar estados de carregamento, erro e conteúdo vazio. A linguagem da interface inicial deve permanecer em PT-BR.

## Current Experience

- Nome visivel ao usuario: **LeitorBI Open**, inclusive no titulo da aba do navegador.
- A marca no topo do workspace e da demonstracao retorna a Landing Page.
- A Landing oferece `Iniciar` no canto superior direito e no conteudo principal; ambos abrem o workspace publico.
- Direcao visual atual: **Caderno de evidencias**, com capa tecnica, indice, folios, papel pautado e marcacoes de auditoria.
- Componentes contidos e confiaveis usam tinta escura, papel aquecido, ferrugem para acoes e azul ardósia para informacao tecnica.
- Ambiente de desenvolvimento: frontend em `5174` e backend em `8001`; o frontend usa `8001` como fallback local da API.

### Landing copy atual

- O cabecalho mantem apenas a identidade principal `LeitorBI Open`, sem `Open / JSON`.
- O indice lateral nao exibe mais `Indice 01`.
- O carimbo lateral exibe `LeitorBI Open`.
- A folha de abertura usa `Análise Técnica` e `Tenha controle do seu modelo · leitura técnica e rastreável.`.
