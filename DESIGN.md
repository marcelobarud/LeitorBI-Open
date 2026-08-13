# LeitorBI Open — Design

## Direction

**Caderno de evidências** is the visual world for the Open edition. The interface treats a Power BI export as a technical record: a cover sheet on the Landing, an index rail in the workspace, and ruled evidence rows for model data.

Seed: `c659c7dc` · assigned direction 3  
Product metaphor: technical audit notebook  
Component tone: restrained and reliable

## Visual grammar

- Warm paper surfaces with quiet ruled lines establish the reading field.
- Deep ink (`#101820`) owns navigation and high-contrast headers.
- Rust (`#d95f39`) marks actions, active states, and review attention.
- Slate blue (`#315c72`) carries technical secondary information.
- Dividers and folios replace a grid of generic floating cards.
- UI text stays in the existing system sans stack; technical labels and data use a monospace face only where the data benefits from it.

## Component decisions

- Landing: cover sheet, index, folio metadata, evidence preview, and direct “Iniciar” entry points.
- Workspace: dark index rail, paper content field, model record header, ruled upload state, and dense technical tables.
- Empty/loading/error states use the same paper-and-rule language so failure does not feel like a separate product.
- Tutorial and comparison retain their existing flows while adopting the same sheet, divider, and annotation treatment.

## Interaction and accessibility

- Keyboard focus is visible with a rust outline.
- Existing accessible button names, file labels, disabled states, error roles, and reduced-motion support are preserved.
- Mobile collapses the index into a compact record line, stacks the cover and preview, and keeps the workspace navigation horizontally scrollable.
- The single authored motion is a short evidence-sheet reveal; `prefers-reduced-motion` disables it.

## Validation record

- Frontend tests: 19/19 passing.
- Frontend production build: passing.
- Backend health endpoint: HTTP 200.
- Impeccable detector: no findings.
- Visual review: Landing and workspace checked at desktop and 390×844 mobile viewport.

Status: implementado localmente no branch `test` em 2026-08-12.  
Fonte da direcao: Impeccable, escolha do usuario.

## Context maintenance

Este arquivo registra apenas a linguagem visual e suas decisoes de implementacao. O historico geral do produto fica em `AI_CONTEXT LEITOR OPEN.md`; proposito, usuarios e restricoes ficam em `PRODUCT.md`.

## Landing copy refinement

The approved visual structure remains unchanged. The current cover copy uses “Análise Técnica” with “Tenha controle do seu modelo · leitura técnica e rastreável.”, the side stamp reads “LeitorBI Open”, and the header/index no longer show “Open / JSON” or “Índice 01”.

The Landing benefit rail now uses three equal-weight rust dots instead of numbered labels. The technical preview keeps its panel treatment without the `FOLHA 01 / 04` folio, and the first “Como começar” step uses the Tutorial's `Tabular Editor` release link and external-link behavior.

Technical resources share the `TechnicalLink` component: `Tabular Editor` and `PBIModelExport` use the same rust technical-link treatment, visible hover/focus, new-tab behavior, and `noopener noreferrer`. The official PBIModelExport destination is `https://github.com/hihipy/pbi-model-export/blob/main/PBIModelExport.csx`.

## Brand system

The `Brand` component is the shared identity implementation for the Landing, Workspace, and Demo. It keeps the Landing mark as the visual source of truth and exposes a `sidebar` variant for dark rails: the mark block is paper white and the `LB` monogram is deep ink black. Workspace and Demo use the same sidebar variant and preserve the existing keyboard-accessible return-to-Landing button behavior.
