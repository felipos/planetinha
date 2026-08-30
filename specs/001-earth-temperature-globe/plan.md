# Implementation Plan: Globo de Temperatura Global em Tempo Real

**Branch**: `001-earth-temperature-globe` | **Date**: 2026-08-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-earth-temperature-globe/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Página pública única (SPA estático, sem backend) que renderiza um globo 3D interativo da Terra
(rotação/zoom via mouse e touch) com um heatmap de temperatura em gradiente de cor sobreposto,
alimentado pela API pública do Open-Meteo. O usuário pode inspecionar um ponto para ver a
temperatura exata; os dados são buscados em lote (múltiplas coordenadas por requisição) e
re-buscados a cada 30 minutos (ver `research.md` §6 — resolve o TODO de intervalo de polling
deixado no spec). Stack: TypeScript estrito + Vite + React + `three.js` puro para o globo +
`lucide-react` para ícones, construído sob Node.js 24 LTS, seguindo a arquitetura em camadas
(Domain/Use Cases/Data Sources/Presentation) exigida pela constituição.

## Technical Context

**Language/Version**: TypeScript 5.x (`"strict": true`) sobre Node.js 24 LTS (apenas
build/dev — o artefato final é um SPA estático executado no navegador, sem runtime Node em
produção).

**Primary Dependencies**: `react` + `react-dom` (UI), `three` (renderização 3D/WebGL do globo,
inclui `OrbitControls` do próprio pacote), `lucide-react` (ícones). Ver `research.md` para
alternativas descartadas de cada escolha.

**Storage**: N/A — sem backend/banco de dados. Cache efêmero em memória (estado React) do
`TemperatureGrid` mais recente; sem persistência entre sessões (`GlobeViewState` também é
efêmero, conforme Key Entities do spec).

**Testing**: Vitest + `@testing-library/react` + `@testing-library/jest-dom` (componentes/hooks),
`vitest-axe` (verificação automatizada de acessibilidade, Princípio V). Validação end-to-end
manual guiada por `quickstart.md` (sem Playwright/Cypress neste MVP — ver `research.md` §8).

**Target Platform**: Navegadores modernos com WebGL2 (desktop e mobile), sem suporte a
navegadores antigos (conforme Assumptions do spec).

**Project Type**: Aplicação web frontend única (SPA), sem componente de backend/servidor próprio
— chama a API pública do Open-Meteo diretamente do navegador.

**Performance Goals**: rotação/zoom do globo sem travamentos perceptíveis (SC-002, alvo
implícito ~60fps); padrão global de temperatura identificável em até 5s após carregamento
(SC-001).

**Constraints**: dados nunca mais desatualizados que 60 minutos (FR-007/SC-003); uso da API do
Open-Meteo consciente do limite de 10.000 requisições/dia não-comercial (research.md §5–§6);
"menor número possível de bibliotecas" (pedido explícito do usuário); WCAG 2.1 AA (Princípio V);
mobile-first a partir de ~360–390px (Princípio IV); TypeScript strict + `curly: all` via lint
bloqueante (Princípios I e II).

**Scale/Scope**: página pública única, tráfego modesto (Assumptions do spec); grade de
referência inicial de ~10° de resolução (~684 pontos, ~7 requisições em lote por atualização,
ajustável — ver `research.md` §6); 4 user stories (P1×2, P2, P3).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Gate | Status |
|---|---|---|
| I. TypeScript Estrito | `tsconfig.json` com `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`; sem `any` não justificado | PASS — planejado em `quickstart.md` Setup; tipos de domínio em `data-model.md` totalmente explícitos |
| II. Chaves Obrigatórias | ESLint `curly: ["error", "all"]` bloqueante no build | PASS — planejado em `research.md` §9 |
| III. Arquitetura em Camadas | Domain/Use Cases/Data Sources/Presentation, dependência sempre para dentro, portas na fronteira | PASS — estrutura de diretórios abaixo e `contracts/temperature-data-source-port.md` definem a porta explícita entre Use Cases e Data Sources |
| IV. Mobile-First | UI desenhada primeiro para ~360–390px, `min-width` como base; decisões de UI com impacto visível apresentadas com recomendação + alternativas | PASS — decisões de UI (framework, biblioteca 3D, overlay, paleta) documentadas com recomendação/alternativas em `research.md` §2–4; verificação visual mobile listada em `quickstart.md` |
| V. Acessibilidade (a11y) | WCAG 2.1 AA mínimo; HTML semântico; navegável por teclado; alt text; contraste 4.5:1; `eslint-plugin-jsx-a11y` + axe no fluxo de revisão | PASS — `vitest-axe` + `eslint-plugin-jsx-a11y` planejados (`research.md` §8–9); requisito de indicador não-dependente de cor já é FR-012/SC-005 do spec |

Nenhuma violação identificada nesta fase — nenhuma entrada necessária em Complexity Tracking.

**Re-check pós-Fase 1 (Design)**: `data-model.md`, `contracts/` e a estrutura de diretórios acima
confirmam a separação de camadas (nenhum tipo de `domain/`/`application/` referencia `react`,
`three` ou `fetch`), a porta `TemperatureDataSourcePort` implementa a inversão de dependência
exigida, e nenhuma decisão de design introduziu necessidade de exceção a nenhum dos 5 princípios.
Todos os gates continuam PASS — nenhuma atualização necessária.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── domain/                  # entidades + regras puras (Princípio III)
│   ├── temperature-reading.ts
│   ├── temperature-grid.ts
│   ├── selected-point.ts
│   ├── color-scale.ts       # gradiente diverging (research.md §4), sem dependência externa
│   └── interpolation.ts     # IDW/bilinear para heatmap e lookup de ponto
│
├── application/              # Use Cases + ports (interfaces)
│   ├── ports/
│   │   └── temperature-data-source-port.ts   # ver contracts/temperature-data-source-port.md
│   ├── fetch-temperature-grid.usecase.ts
│   └── select-point.usecase.ts
│
├── infrastructure/            # implementações concretas (Princípio III)
│   └── open-meteo/
│       └── open-meteo-temperature-data-source.ts  # ver contracts/open-meteo-forecast-request.md
│
├── presentation/               # UI React (só aqui pode importar react/three/lucide-react)
│   ├── components/
│   │   ├── Globe/            # canvas three.js + useGlobeRenderer (rotação/zoom, textura do heatmap)
│   │   ├── TemperatureLegend/
│   │   ├── PointInspector/   # painel/tooltip do ponto selecionado (US3)
│   │   └── DataStatusBanner/ # loading / erro / stale (Edge Cases)
│   ├── hooks/
│   │   ├── useTemperatureGrid.ts   # chama FetchTemperatureGridUseCase + timer de 30min
│   │   └── useSelectedPoint.ts
│   └── App.tsx
│
└── main.tsx                   # bootstrap Vite/React, monta o data source concreto (composition root)

tests/
├── unit/            # domain (color-scale, interpolation, validação de entidades)
├── integration/     # use cases com um fake TemperatureDataSourcePort
└── component/        # componentes de presentation (Testing Library + vitest-axe)
```

**Structure Decision**: SPA de projeto único (não há frontend+backend separados — o "backend" é
a API pública do Open-Meteo, chamada diretamente do navegador via `infrastructure/open-meteo/`).
A estrutura acima implementa diretamente a Arquitetura em Camadas do Princípio III: `domain/` e
`application/` nunca importam de `infrastructure/` ou `presentation/`; `infrastructure/`
implementa a porta definida em `application/ports/`; `presentation/` é a única camada que
depende de `react`, `three` e `lucide-react`, consumindo `application/` apenas através de hooks
finos.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
