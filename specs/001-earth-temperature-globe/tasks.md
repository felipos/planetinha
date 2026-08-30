---

description: "Task list template for feature implementation"
---

# Tasks: Globo de Temperatura Global em Tempo Real

**Input**: Design documents from `/specs/001-earth-temperature-globe/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Não solicitados explicitamente no spec. Tarefas de teste incluídas apenas onde a
constituição do projeto exige (verificação automatizada de a11y, Princípio V) e como
tarefas gerais de qualidade na fase de Polish — não como TDD por user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Projeto único (SPA frontend, sem backend) — caminhos conforme `plan.md` Project Structure:
`src/domain/`, `src/application/`, `src/infrastructure/`, `src/presentation/`, `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização do projeto Vite + TypeScript + React sobre Node 24 LTS, com lint e
testes configurados conforme a constituição.

- [X] T001 Criar o projeto com `npm create vite@latest . -- --template react-ts` na raiz do
      repositório
- [X] T002 Definir Node.js 24 LTS: adicionar `"engines": { "node": ">=24" }` em `package.json` e
      criar `.nvmrc` com o conteúdo `24` (depende de T001)
- [X] T003 Instalar dependências de runtime `react`, `react-dom`, `three`, `lucide-react` em
      `package.json` (depende de T001)
- [X] T004 Instalar dependências de desenvolvimento `eslint`, `typescript-eslint`,
      `eslint-plugin-jsx-a11y`, `eslint-plugin-react-hooks`, `vitest`,
      `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `vitest-axe`,
      `@types/three` em `package.json` (depende de T003)
- [X] T005 [P] Configurar `tsconfig.json` com `"strict": true`, `noImplicitAny`,
      `strictNullChecks`, `noUncheckedIndexedAccess` (Princípio I da constituição) (depende de
      T004)
- [X] T006 [P] Configurar ESLint (`eslint.config.js`) com `curly: ["error", "all"]`
      (Princípio II) e as regras recomendadas de `eslint-plugin-jsx-a11y` +
      `eslint-plugin-react-hooks` como bloqueantes de build (Princípio V) (depende de T004)
- [X] T007 [P] Configurar `vitest.config.ts` com ambiente `jsdom` e arquivo de setup
      `tests/setup.ts` importando `@testing-library/jest-dom` (depende de T004)
- [X] T008 [P] Criar a estrutura de diretórios em camadas: `src/domain/`,
      `src/application/ports/`, `src/infrastructure/open-meteo/`,
      `src/presentation/components/{Globe,TemperatureLegend,PointInspector,DataStatusBanner}/`,
      `src/presentation/hooks/`, `tests/{unit,integration,component}/` conforme `plan.md`
      Project Structure (depende de T001)
- [X] T009 [P] Validar as suposições de risco do Open-Meteo do `quickstart.md` Passo 0 (CORS
      para chamada direta do navegador e limite real de coordenadas por requisição em
      `/v1/forecast`) e registrar o resultado observado em
      `specs/001-earth-temperature-globe/research.md` (atualizar a nota de suposição se o
      limite real divergir de 100)

**Checkpoint**: projeto scaffolded, lint/testes/strict TS configurados, estrutura de camadas
criada, suposições de risco da API validadas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos de domínio, porta de dados, use case de busca e a implementação concreta do
data source do Open-Meteo — infraestrutura da qual TODAS as user stories dependem.

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase estar completa.

- [X] T010 [P] Criar tipo `TemperatureReading` com validação de faixa de
      latitude/longitude e tratamento explícito de `temperatureCelsius: null` em
      `src/domain/temperature-reading.ts` (ver `data-model.md`)
- [X] T011 [P] Criar tipo `TemperatureGrid` em `src/domain/temperature-grid.ts` (ver
      `data-model.md`)
- [X] T012 [P] Criar union discriminada `DataFetchStatus`
      (`idle | loading | success | stale-error | hard-error`) em
      `src/domain/data-fetch-status.ts` (ver `data-model.md`)
- [X] T013 [P] Criar tipo `SelectedPoint` em `src/domain/selected-point.ts` (ver
      `data-model.md`)
- [X] T014 [P] Criar tipo `GlobeViewState` em `src/domain/globe-view-state.ts` (ver
      `data-model.md`)
- [X] T015 [P] Implementar escala de cor diverging manual (azul profundo → azul claro →
      amarelo → laranja → vermelho, poucos pontos de controle interpolados linearmente) em
      `src/domain/color-scale.ts` (ver `research.md` §4)
- [X] T016 [P] Implementar interpolação de grade (IDW/bilinear entre pontos vizinhos) para
      geração do heatmap e lookup de ponto específico em `src/domain/interpolation.ts` (ver
      `research.md` §4)
- [X] T017 Definir a interface `TemperatureDataSourcePort` e o tipo `TemperatureGridRequest`
      em `src/application/ports/temperature-data-source-port.ts` conforme
      `contracts/temperature-data-source-port.md` (depende de T011)
- [X] T018 [P] Implementar `FetchTemperatureGridUseCase` em
      `src/application/fetch-temperature-grid.usecase.ts`, dependendo apenas de
      `TemperatureDataSourcePort` (depende de T017)
- [X] T019 [P] Implementar `OpenMeteoTemperatureDataSource` (geração dos pontos de grade a
      partir de `resolutionDegrees`, batching em lotes conforme limite validado em T009,
      chamada HTTP ao endpoint `/v1/forecast`, normalização objeto-único vs array, e mapeamento
      de erros de rede/HTTP/`error:true` para rejeição da Promise) em
      `src/infrastructure/open-meteo/open-meteo-temperature-data-source.ts` conforme
      `contracts/open-meteo-forecast-request.md` (depende de T017, T009)
- [X] T020 Montar a composition root: instanciar `OpenMeteoTemperatureDataSource` e
      `FetchTemperatureGridUseCase`, renderizar `<App />` em `src/main.tsx` (depende de T018,
      T019)
- [X] T021 Criar o esqueleto de `src/presentation/App.tsx` com os containers de layout (área do
      globo, área da legenda, área do inspetor de ponto, área do banner de status), sem lógica
      de dados ainda (depende de T020)

**Checkpoint**: fundação pronta — a implementação das user stories pode começar.

---

## Phase 3: User Story 1 - Visualizar o padrão global de temperatura (Priority: P1) 🎯 MVP

**Goal**: ao carregar a página, o globo 3D renderiza com um gradiente de cor contínuo cobrindo
toda a superfície (incluindo oceanos), refletindo os dados reais de temperatura do Open-Meteo,
com uma legenda visível.

**Independent Test**: abrir a página e verificar que o globo é renderizado com gradiente de cor
visível cobrindo toda a superfície, com legenda associando cores a valores de temperatura.

### Implementation for User Story 1

- [X] T022 [P] [US1] Implementar hook `useTemperatureGrid` (busca inicial via
      `FetchTemperatureGridUseCase` no mount, expõe `DataFetchStatus`) em
      `src/presentation/hooks/useTemperatureGrid.ts`
- [X] T023 [P] [US1] Implementar hook `useGlobeRenderer` (ciclo de vida da cena/câmera/renderer
      three.js e da geometria da esfera, montagem/desmontagem do canvas WebGL) em
      `src/presentation/components/Globe/useGlobeRenderer.ts`
- [X] T024 [P] [US1] Implementar geração da textura de heatmap (bitmap 2D equiretangular via
      `interpolation.ts` + `color-scale.ts`, aplicado como `THREE.CanvasTexture`), incluindo
      marcação visual distinta para pontos com `temperatureCelsius: null` ("sem dado", nunca
      cor enganosa) em `src/presentation/components/Globe/heatmap-texture.ts`
- [X] T025 [US1] Implementar componente `Globe` conectando `useGlobeRenderer` +
      `heatmap-texture` + dados de `useTemperatureGrid` em
      `src/presentation/components/Globe/Globe.tsx` (depende de T022, T023, T024)
- [X] T026 [P] [US1] Implementar componente `TemperatureLegend` (relação cor↔faixa de
      temperatura, com rótulos em texto) em
      `src/presentation/components/TemperatureLegend/TemperatureLegend.tsx` (depende de T015)
- [X] T027 [P] [US1] Implementar componente `DataStatusBanner` (estados de carregamento e erro,
      região acessível anunciada a leitores de tela) em
      `src/presentation/components/DataStatusBanner/DataStatusBanner.tsx` (depende de T012)
- [X] T028 [US1] Montar `Globe`, `TemperatureLegend` e `DataStatusBanner` dentro de
      `src/presentation/App.tsx` (depende de T025, T026, T027)

**Checkpoint**: User Story 1 está completa e testável de forma independente (SC-001).

---

## Phase 4: User Story 2 - Rotacionar e ampliar o globo (Priority: P1)

**Goal**: o usuário gira o globo livremente (arraste com mouse/touch) e aplica zoom in/out
(scroll/pinça) de forma suave, mantendo o gradiente legível em qualquer nível de zoom.

**Independent Test**: arrastar o globo com mouse/touch verifica rotação suave em qualquer eixo;
usar scroll/pinça verifica zoom in/out contínuo.

### Implementation for User Story 2

- [X] T029 [US2] Integrar `OrbitControls`
      (`three/examples/jsm/controls/OrbitControls`) em `useGlobeRenderer`: habilitar damping,
      desabilitar pan, mapear arraste→rotação e pinça/scroll→zoom em
      `src/presentation/components/Globe/useGlobeRenderer.ts` (depende de T023)
- [X] T030 [US2] Expor o `GlobeViewState` (rotação/zoom) atualizado a partir dos eventos
      `change` do `OrbitControls` no valor de retorno do hook em
      `src/presentation/components/Globe/useGlobeRenderer.ts` (depende de T029, mesmo arquivo)
- [X] T031 [P] [US2] Ajustar filtragem/mipmaps da `CanvasTexture` do heatmap para manter o
      gradiente legível em qualquer nível de zoom em
      `src/presentation/components/Globe/heatmap-texture.ts` (depende de T024, T029)
- [X] T032 [P] [US2] Ajustar `touch-action`/CSS no container do canvas do globo para que
      gestos de arraste/pinça não disparem scroll/zoom da página em mobile em
      `src/presentation/components/Globe/Globe.tsx` (depende de T025, T029)

**Checkpoint**: User Stories 1 E 2 funcionam de forma independente (SC-002).

---

## Phase 5: User Story 3 - Consultar a temperatura de um ponto específico (Priority: P2)

**Goal**: ao tocar/clicar em um ponto do globo, um painel/tooltip exibe o valor numérico exato
da temperatura e a localização aproximada daquele ponto.

**Independent Test**: clicar/tocar em um ponto do globo e verificar que aparece um valor
numérico de temperatura e a localização aproximada daquele ponto.

### Implementation for User Story 3

- [X] T033 [P] [US3] Implementar `SelectPointUseCase` (recebe lat/long, retorna
      `SelectedPoint` interpolado a partir do `TemperatureGrid` atual) em
      `src/application/select-point.usecase.ts` (depende de T013, T016)
- [X] T034 [US3] Adicionar handler de clique/toque com raycasting do three.js contra a
      geometria da esfera, convertendo o ponto de interseção em lat/long, em
      `src/presentation/components/Globe/useGlobeRenderer.ts` (depende de T030, mesmo arquivo)
- [X] T035 [US3] Implementar hook `useSelectedPoint` consumindo `SelectPointUseCase` com o
      lat/long emitido pelo handler de raycast em
      `src/presentation/hooks/useSelectedPoint.ts` (depende de T033, T034)
- [X] T036 [US3] Implementar componente `PointInspector` (painel/tooltip acessível com valor
      numérico de temperatura + localização aproximada, dispensável via teclado) em
      `src/presentation/components/PointInspector/PointInspector.tsx` (depende de T035)
- [X] T037 [US3] Conectar `PointInspector` + `useSelectedPoint` em
      `src/presentation/App.tsx` (depende de T036)

**Checkpoint**: User Stories 1, 2 e 3 funcionam de forma independente.

---

## Phase 6: User Story 4 - Manter os dados de temperatura atualizados (Priority: P3)

**Goal**: enquanto a página permanece aberta, os dados de temperatura são buscados novamente a
cada 30 minutos (ver `research.md` §6) sem exigir reload manual, preservando a última
visualização válida em caso de falha.

**Independent Test**: manter a página aberta além do intervalo de atualização configurado e
verificar que o gradiente muda para refletir novos dados, sem recarregar a página manualmente.

### Implementation for User Story 4

- [X] T038 [P] [US4] Definir a constante `TEMPERATURE_REFRESH_INTERVAL_MS` (30 minutos,
      ajustável para desenvolvimento/teste) em `src/application/config.ts` (ver `research.md`
      §6)
- [X] T039 [US4] Adicionar timer de re-busca periódica ao hook `useTemperatureGrid`,
      transicionando `DataFetchStatus` para `stale-error` (preservando o último
      `TemperatureGrid` bem-sucedido) em caso de falha do refresh, em
      `src/presentation/hooks/useTemperatureGrid.ts` (depende de T022, T038)
- [X] T040 [US4] Regenerar a textura de heatmap e atualizar o `DataStatusBanner` quando um
      refresh tiver sucesso/falha em `src/presentation/components/Globe/Globe.tsx` e
      `src/presentation/components/DataStatusBanner/DataStatusBanner.tsx` (depende de T039)

**Checkpoint**: todas as 4 user stories funcionam de forma independente (SC-003).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: qualidade transversal exigida pela constituição (mobile-first, a11y) e validação
final ponta-a-ponta.

- [X] T041 [P] Revisão mobile-first: verificar `src/presentation/App.tsx` e todos os
      componentes de presentation em viewport ≤400px (SC-004), garantindo que apenas
      media queries `min-width` sejam usadas como base do layout (Princípio IV)
- [X] T042 [P] Verificar que a identificação de temperatura nunca depende só da cor (FR-012,
      SC-005) em `TemperatureLegend` (rótulos em texto) e `PointInspector` (valor numérico)
- [X] T043 [P] Adicionar testes automatizados de acessibilidade com `vitest-axe` para `Globe`,
      `TemperatureLegend`, `PointInspector` e `DataStatusBanner` em `tests/component/`
      (Princípio V)
- [X] T044 [P] Adicionar testes unitários para `src/domain/color-scale.ts` e
      `src/domain/interpolation.ts` em `tests/unit/`
- [X] T045 [P] Adicionar teste de integração para `FetchTemperatureGridUseCase` usando um
      `TemperatureDataSourcePort` fake (caminhos de sucesso, erro e stale-error) em
      `tests/integration/`
- [X] T046 Executar a checklist completa de validação do `quickstart.md` (todos os Acceptance
      Scenarios e Edge Cases do spec, incluindo simulação de daltonismo e bloqueio da API)
      (depende de T041–T045)
- [X] T047 Verificar o build de produção (`npm run build && npm run preview`) confirmando que a
      aplicação funciona como SPA estático, sem backend próprio (depende de T046)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: depende da conclusão do Setup — BLOQUEIA todas as user stories
- **User Stories (Phase 3+)**: todas dependem da conclusão da Foundational
  - US1 e US2 (ambas P1) podem ser feitas em sequência (US2 depende do componente `Globe`
    criado em US1) ou por pessoas diferentes coordenando no mesmo arquivo `useGlobeRenderer.ts`
  - US3 depende de US1 (globo) e US2 (raycast usa os controles de câmera já integrados)
  - US4 depende apenas da Foundational (`useTemperatureGrid` de US1 é estendido, não recriado)
- **Polish (Final Phase)**: depende de todas as user stories desejadas estarem completas

### User Story Dependencies

- **User Story 1 (P1)**: pode começar após a Foundational — sem dependência de outras stories
- **User Story 2 (P1)**: pode começar após a Foundational, mas reutiliza o arquivo
  `useGlobeRenderer.ts` e o componente `Globe.tsx` criados em US1 — na prática, sequencial
  após US1
- **User Story 3 (P2)**: reutiliza `useGlobeRenderer.ts` (raycast) criado/estendido em
  US1/US2 — sequencial após US2
- **User Story 4 (P3)**: estende `useTemperatureGrid.ts` de US1 — pode ser feita em paralelo
  com US2/US3 por outra pessoa, já que não toca nos mesmos arquivos

### Within Each User Story

- Tipos/hooks/use cases antes de componentes de UI que os consomem
- Componentes de UI antes da integração em `App.tsx`
- Story completa antes de avançar para a próxima prioridade

### Parallel Opportunities

- Todas as tarefas [P] do Setup (T005–T009) após T004
- Todas as tarefas [P] da Foundational (T010–T016) em paralelo entre si; T018 e T019 em
  paralelo entre si após T017
- US1: T022, T023, T024 em paralelo entre si; T026, T027 em paralelo entre si e com T022–T024
- US2: T031 e T032 em paralelo entre si após T029
- US3: T033 em paralelo com T034 (arquivos diferentes)
- US4: T038 pode ser feito a qualquer momento após a Foundational, em paralelo com US2/US3
- Polish: T041–T045 em paralelo entre si

---

## Parallel Example: User Story 1

```bash
# Após a Foundational (Phase 2) completa, disparar em paralelo:
Task: "Implementar hook useTemperatureGrid em src/presentation/hooks/useTemperatureGrid.ts"
Task: "Implementar hook useGlobeRenderer em src/presentation/components/Globe/useGlobeRenderer.ts"
Task: "Implementar geração da textura de heatmap em src/presentation/components/Globe/heatmap-texture.ts"

# Em paralelo com os três acima (arquivos independentes):
Task: "Implementar componente TemperatureLegend em src/presentation/components/TemperatureLegend/TemperatureLegend.tsx"
Task: "Implementar componente DataStatusBanner em src/presentation/components/DataStatusBanner/DataStatusBanner.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 apenas)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (CRÍTICO — bloqueia todas as stories)
3. Completar Phase 3: User Story 1
4. **PARAR e VALIDAR**: testar User Story 1 de forma independente (globo colorido + legenda
   visíveis ao carregar a página)
5. Deploy/demo se estiver pronto

### Incremental Delivery

1. Setup + Foundational → fundação pronta
2. + User Story 1 → testar independentemente → deploy/demo (MVP visual!)
3. + User Story 2 → testar independentemente → deploy/demo (globo navegável)
4. + User Story 3 → testar independentemente → deploy/demo (inspeção de ponto)
5. + User Story 4 → testar independentemente → deploy/demo (atualização periódica)
6. Polish (mobile-first, a11y, testes, build de produção)

### Parallel Team Strategy

Com múltiplos desenvolvedores:

1. Time completa Setup + Foundational junto
2. Após a Foundational:
   - Dev A: User Story 1, depois User Story 2 (mesmo arquivo `useGlobeRenderer.ts`)
   - Dev B: User Story 4 (arquivos independentes de US1/US2) assim que US1 tiver o hook
     `useTemperatureGrid` pronto
   - Dev C: prepara User Story 3 (`SelectPointUseCase`, T033) enquanto aguarda US2 terminar o
     raycast base
3. Polish em conjunto ao final

---

## Notes

- [P] tasks = arquivos diferentes, sem dependências entre si
- [Story] label mapeia a tarefa à user story correspondente para rastreabilidade
- `useGlobeRenderer.ts` é compartilhado entre US1/US2/US3 — tarefas que o editam
  (T023, T029, T030, T034) são necessariamente sequenciais entre si, mesmo dentro de
  stories diferentes
- Verificar lint (`curly: all`, `jsx-a11y`) e `tsc --noEmit` sem erros antes de considerar
  qualquer tarefa concluída (Princípios I, II, V)
- Fazer commit após cada tarefa ou grupo lógico de tarefas
- Parar em qualquer checkpoint para validar a story de forma independente
- Evitar: tarefas vagas, conflitos no mesmo arquivo entre tarefas paralelas, dependências
  entre stories que quebrem a independência de teste
