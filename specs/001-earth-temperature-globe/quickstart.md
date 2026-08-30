# Quickstart: Globo de Temperatura Global em Tempo Real

Guia de validação — não é código de implementação. Ver `data-model.md` e `contracts/` para
detalhes de tipos e interfaces.

## Pré-requisitos

- Node.js 24 LTS instalado (`node -v` deve mostrar `v24.x`).
- Navegador moderno com suporte a WebGL2.

## Setup

```bash
npm create vite@latest vento -- --template react-ts
cd vento
npm install three
npm install lucide-react
npm install -D eslint typescript-eslint eslint-plugin-jsx-a11y eslint-plugin-react-hooks \
  vitest @testing-library/react @testing-library/jest-dom jsdom vitest-axe @types/three
```

Configurar `tsconfig.json` com `"strict": true`, `noImplicitAny`, `strictNullChecks`,
`noUncheckedIndexedAccess` (Princípio I da constituição) e ESLint com `curly: ["error", "all"]`
(Princípio II) + regras de `eslint-plugin-jsx-a11y` (Princípio V) como bloqueantes.

## Passo 0 — validar as duas suposições de risco do Open-Meteo (antes de construir a UI)

Rodar no console do navegador ou em um script rápido, **antes** de investir na implementação:

```js
fetch(
  "https://api.open-meteo.com/v1/forecast?" +
  "latitude=10,20,-10&longitude=-40,30,150&current=temperature_2m&temperature_unit=celsius"
).then((r) => r.json()).then(console.log);
```

- **Esperado**: resposta 200 sem erro de CORS, array com 3 objetos, cada um com
  `current.temperature_2m`. Se houver erro de CORS, revisitar `research.md` §10 (pode exigir
  proxy) antes de prosseguir.
- Repetir com 100 coordenadas para confirmar o limite de lote assumido em
  `contracts/open-meteo-forecast-request.md`.

## Rodando localmente

```bash
npm run dev
```

Abrir a URL impressa pelo Vite (padrão `http://localhost:5173`).

## Cenários de validação (ligados aos Acceptance Scenarios do spec)

1. **US1 — Padrão global de temperatura (P1)**: ao abrir a página, o globo deve renderizar com um
   gradiente de cor cobrindo toda a superfície (incluindo oceanos) e uma legenda visível
   relacionando cor a faixa de temperatura, em até 5s após o carregamento (SC-001).
2. **US2 — Rotacionar/zoom (P1)**: arrastar o globo (mouse e touch) gira suavemente em qualquer
   eixo; scroll/pinça altera o zoom suavemente, mantendo o gradiente legível em qualquer nível de
   zoom (SC-002). Testar em viewport mobile (≤400px) e desktop, conforme Princípio IV
   (mobile-first) — verificar visualmente em viewport mobile antes de considerar concluído.
3. **US3 — Inspecionar ponto (P2)**: clicar/tocar em um ponto do globo mostra um painel/tooltip
   com o valor numérico da temperatura e a localização aproximada daquele ponto.
4. **US4 — Atualização periódica (P3)**: manter a página aberta além do intervalo de refresh
   configurado (`TEMPERATURE_REFRESH_INTERVAL_MS`, ver `research.md` §6) e confirmar que o
   gradiente é atualizado automaticamente, sem reload manual. Para validar sem esperar 30
   minutos, reduzir temporariamente a constante de intervalo em ambiente de desenvolvimento.
5. **Edge case — API indisponível**: bloquear `api.open-meteo.com` (DevTools → Network →
   block request domain) e recarregar; a página MUST informar que os dados não puderam ser
   atualizados, sem tela em branco. Com um `TemperatureGrid` já carregado, uma falha subsequente
   MUST manter a última visualização válida (`DataFetchStatus.kind === "stale-error"`).

6. **Edge case — sem dado em um ponto**: um ponto com `temperatureCelsius: null` (ver
   `data-model.md`) MUST ser marcado visualmente como "sem dado", nunca receber uma cor do
   gradiente.
7. **Edge case — daltonismo**: usando um simulador de daltonismo (ex.: DevTools "Emulate vision
   deficiencies" → Deuteranopia), confirmar que a legenda em texto e o valor numérico ao
   inspecionar um ponto permitem identificar a temperatura sem depender só da cor (FR-012,
   SC-005).
8. **A11y automatizado**: `npm run test` deve incluir verificação `vitest-axe` sem violações
   sérias/críticas nos componentes principais (globo — como landmark acessível ao redor do
   canvas —, legenda, painel de inspeção).

## Build de produção

```bash
npm run build
npm run preview
```

Confirmar que o build estático funciona sem nenhum servidor/backend além de servir arquivos
estáticos (decisão de hospedagem em `research.md` §10).
