# Research: Globo de Temperatura Global em Tempo Real

**Input do usuário para o stack**: Node 24 LTS, TypeScript, Vite, "menor número possível de
bibliotecas", lucide-react para ícones (se necessário).

Cada decisão abaixo segue o formato Decision / Rationale / Alternatives considered, conforme
exigido pelo processo de planejamento. Decisões com impacto visível de UI/UX são sinalizadas
explicitamente (Princípio IV da constituição exige apresentar recomendação + alternativas, nunca
aplicar silenciosamente).

## 1. Runtime de build e linguagem

- **Decision**: Node.js 24 LTS como runtime de desenvolvimento/build; TypeScript 5.x com
  `"strict": true` (Princípio I da constituição); Vite como bundler/dev server.
- **Rationale**: pedido explícito do usuário; Vite oferece dev server rápido com HMR e build de
  produção enxuto (tree-shaking, code-splitting automático), sem necessidade de configuração
  manual de bundler. Node só é necessário em tempo de build/dev — o artefato final é um SPA
  estático (HTML/JS/CSS) servido por qualquer host estático, sem runtime Node em produção.
- **Alternatives considered**: Next.js (rejeitado — traz SSR/roteamento/servidor que este projeto
  não precisa, mais bibliotecas do que o "mínimo possível" pedido); Webpack/CRA (rejeitado — CRA
  está descontinuado, Webpack exige mais configuração manual que Vite para o mesmo resultado).

## 2. Framework de UI

- **Decision**: React 19 + `react-dom`, via template `vite react-ts`.
- **Rationale**: o usuário pediu `lucide-react`, que é um pacote de ícones para React — isso
  implica React como framework de UI. React tem o maior ecossistema de bindings para Three.js e
  de ferramentas de acessibilidade (`eslint-plugin-jsx-a11y`) exigidas pela constituição.
- **Alternatives considered**: Vue/Svelte (rejeitados — exigiriam trocar `lucide-react` por
  `lucide-vue-next`/`lucide-svelte`, contradizendo a escolha explícita do usuário); nenhum
  framework / Web Components puros (rejeitado — aumentaria a complexidade de gerenciar estado de
  interação do globo e re-render da legenda/tooltip manualmente).
- **[Decisão de UI com impacto visível — apresentada, não aplicada silenciosamente]**: confirmar
  com o usuário se React é aceitável, já que não foi dito explicitamente (apenas implícito por
  `lucide-react`). Recomendação objetiva acima; alternativa descartada documentada.

## 3. Renderização 3D do globo

- **Decision**: `three.js` puro (sem wrapper como `react-three-fiber` ou `globe.gl`), encapsulado
  em um hook/componente próprio na camada de Presentation (ex.: `useGlobeRenderer`) que gerencia
  a cena, câmera, controles de órbita e o ciclo de vida do canvas WebGL de forma imperativa.
- **Rationale**: `three.js` é hoje o padrão de fato para WebGL de alto nível e é a única
  biblioteca realmente necessária para uma Terra 3D navegável com boa performance em mobile —
  reimplementar WebGL puro (sem biblioteca) seria uma quantidade de trabalho e risco muito maior
  para o mesmo resultado, o que vai contra o objetivo prático do projeto. Evitar
  `react-three-fiber`/`@react-three/drei` mantém o número de dependências no mínimo (menos uma
  camada de abstração/reconciliação sobre o `three.js`), como pedido explicitamente pelo usuário.
  Controles de órbita (rotação/zoom por arraste, scroll e pinça) usam `three/examples/jsm/controls/OrbitControls`,
  que já é parte do próprio pacote `three` (não é uma dependência adicional).
- **Alternatives considered**: `globe.gl` (rejeitado — adiciona `d3` e uma camada de abstração
  própria sobre `three.js`, mais peso de bundle e menos controle fino sobre o shader/textura do
  heatmap do que o projeto precisa); WebGL puro sem biblioteca (rejeitado — complexidade e tempo
  de implementação desproporcionais); Cesium/Deck.gl (rejeitados — voltados a mapas
  geoespaciais com muito mais funcionalidade/peso do que um globo decorativo com um heatmap).
- **[Decisão de UI com impacto visível — apresentada, não aplicada silenciosamente]**:
  recomendação acima com alternativas descartadas e motivo.

## 4. Overlay de temperatura (heatmap) sobre o globo

- **Decision**: gerar, no cliente, uma textura raster equiretangular (ex.: 1440×720) em um
  `<canvas>` 2D offscreen a partir da grade de leituras de temperatura, usando interpolação
  (IDW — inverse-distance weighting — ou bilinear entre os pontos de grade mais próximos) e um
  gradiente de cor diverging escrito à mão (poucos pontos de controle: azul profundo → azul claro
  → amarelo → laranja → vermelho), depois aplicar essa textura como `THREE.CanvasTexture` na
  esfera do globo. Clique/toque usa raycasting do `three.js` para converter o ponto na esfera em
  lat/long e faz lookup + interpolação direta nos dados brutos (independente da textura) para
  exibir o valor exato.
- **Rationale**: evita depender de bibliotecas de escala de cor (`d3-scale-chromatic`) ou de
  heatmap (`heatmap.js`), mantendo o número de bibliotecas mínimo. Uma textura 2D pré-computada é
  barata de gerar (roda uma vez por atualização de dados, não por frame) e permite transições
  suaves sem exigir um shader customizado (GLSL) — que seria mais poderoso, mas
  desproporcionalmente mais complexo de manter para este escopo.
- **Alternatives considered**: shader GLSL customizado (rejeitado nesta fase — maior desempenho
  potencial, mas maior complexidade/risco de manutenção, sem necessidade real dado o volume de
  dados); `d3-scale-chromatic` para as cores (rejeitado — dependência extra para um cálculo de
  poucas linhas que pode ser escrito manualmente).
- **[Decisão de UI com impacto visível — apresentada, não aplicada silenciosamente]**: escala de
  cor exata (paleta) deve ser revisada visualmente com o usuário durante a implementação, já que
  ele não é desenvolvedor front-end (Fluxo de Desenvolvimento da constituição).

## 5. API do Open-Meteo — endpoint, parâmetros e formato (via Context7 MCP, `/websites/open-meteo_en`)

- **Decision**: usar o endpoint principal `GET https://api.open-meteo.com/v1/forecast` com
  `latitude`/`longitude` (arrays separados por vírgula, múltiplas localizações por requisição),
  `current=temperature_2m`, `temperature_unit=celsius`, `timeformat=iso8601`. Para reduzir o
  número de chamadas, os pontos de grade são agrupados em lotes de até 100 coordenadas por
  requisição (mesmo limite documentado nas APIs irmãs de geocoding/elevation do Open-Meteo — a
  ser confirmado empiricamente para o endpoint `/v1/forecast` no início da implementação, como
  primeiro passo do `quickstart.md`).
- **Rationale**: consultado via Context7 conforme decidido na sessão de clarificação do spec.
  Documentação confirma: (a) múltiplas localizações por requisição via listas separadas por
  vírgula; (b) "current" pode retornar qualquer variável também disponível em "hourly" (inclui
  `temperature_2m`); (c) uma requisição com múltiplas localizações/variáveis conta como múltiplas
  chamadas contra o limite de uso, então poucas requisições grandes em lote são preferíveis a
  muitas requisições pequenas.
- **Alternatives considered**: uma requisição por ponto de grade (rejeitado — multiplica
  desnecessariamente o número de chamadas contra o rate limit); usar `hourly=temperature_2m` com
  leitura do primeiro valor (rejeitado — `current` é o campo semanticamente correto para "leitura
  mais recente", conforme FR-013 do spec que exige apenas a condição atual).

## 6. Intervalo de polling/atualização — resolve o TODO deixado no spec (Assumptions)

- **Decision**: **não** usar 10 segundos em produção. Buscar a grade completa uma vez ao carregar
  a página e, depois, re-buscar a cada **30 minutos** (bem abaixo do teto de 60 minutos já
  definido em FR-007/SC-003, e com folga generosa em relação ao limite diário de uso). O valor é
  configurável via uma única constante (ex.: `TEMPERATURE_REFRESH_INTERVAL_MS`) para facilitar
  ajuste futuro sem mudança estrutural.
- **Rationale**: a documentação (via Context7) mostra que a API gratuita/não-comercial do
  Open-Meteo é limitada a **10.000 chamadas por dia** para uso não-comercial, e que uma
  requisição em lote com N localizações **conta como N (ou mais) chamadas** contra esse limite —
  não como 1. Com uma grade de referência de ~10° de resolução (≈684 pontos, ~7 requisições de
  até 100 coordenadas cada), um polling de 10 segundos geraria algo como 7 requisições × 6
  vezes/minuto × 60 × 24 ≈ **60.480 requisições-equivalentes por dia só para um único
  visitante** — muito acima do limite gratuito, além de ser um uso claramente inadequado da API
  pública de terceiros (violaria os termos de uso "non-commercial" e arriscaria bloqueio de IP).
  Além disso, os modelos meteorológicos subjacentes do Open-Meteo são atualizados tipicamente a
  cada 1–3 horas (não a cada segundos) — buscar dados a cada 10s não traria nenhum dado mais
  novo, apenas desperdiçaria chamadas. 30 minutos mantém boa percepção de "quase tempo real",
  fica com folga confortável abaixo do teto de 60 minutos do FR-007/SC-003, e reduz o uso da API
  para uma fração pequena do limite diário mesmo com múltiplos visitantes simultâneos.
- **Alternatives considered**: 10s fixo (rejeitado pelos motivos acima — risco real de rate
  limit/uso inadequado); 60 minutos exatos (rejeitado — deixaria a UI parecendo "trocar de hora
  em hora" de forma perceptível, sem folga de segurança se o teto do FR-007 precisar ser
  reapertado); backend/proxy com cache compartilhado entre todos os visitantes (rejeitado para o
  MVP — adicionaria um serviço/infra extra, contradizendo "menor número possível de bibliotecas"
  e o escopo atual de página pública estática; pode ser revisitado futuramente se o tráfego
  crescer, ver nota abaixo).
- **Nota para o futuro**: se o tráfego crescer muito (muitos visitantes simultâneos, cada um
  fazendo suas próprias chamadas ao Open-Meteo), o limite de 10.000/dia passa a ser compartilhado
  por IP/rede, não por usuário — nesse cenário seria necessário um pequeno proxy/cache
  server-side compartilhado. Fora de escopo para este MVP (tráfego "modesto" por Assumptions do
  spec), mas registrado aqui para não ser esquecido.
- Esta decisão resolve o item **TODO (planejamento)** deixado nas Assumptions do `spec.md`; o
  spec será atualizado para refletir o intervalo definitivo de 30 minutos.

## 7. Gerenciamento de estado

- **Decision**: React hooks nativos (`useState`, `useReducer`, `useEffect`, `useRef`, contexto
  React quando necessário compartilhar entre poucos componentes) — sem biblioteca externa de
  estado global (Redux, Zustand, Jotai, etc.).
- **Rationale**: o estado da aplicação é pequeno e local (grade de temperatura, estado de
  rotação/zoom efêmero, ponto selecionado, status de carregamento/erro) — não há necessidade de
  uma biblioteca de estado global para esse volume, e evitá-la mantém o número de dependências no
  mínimo pedido pelo usuário.
- **Alternatives considered**: Zustand (rejeitado — dependência extra desnecessária para este
  volume de estado); Redux Toolkit (rejeitado — overhead de boilerplate desproporcional ao
  escopo).

## 8. Testes

- **Decision**: Vitest (test runner nativo do ecossistema Vite, zero configuração extra de
  bundler) + `@testing-library/react` e `@testing-library/jest-dom` para testes de componente,
  `jsdom` como ambiente de teste. Para acessibilidade automatizada, `vitest-axe`
  (wrapper leve de `axe-core` para Vitest) integrado aos testes de componente da camada de
  Presentation, conforme exigido pelo Princípio V da constituição.
- **Rationale**: Vitest reaproveita a configuração do Vite (sem bundler duplicado), é o padrão de
  fato para projetos Vite+TS, e essas bibliotecas são dependências de desenvolvimento (não
  entram no bundle de produção), então não conflitam com o pedido de "menor número possível de
  bibliotecas" em produção.
- **Alternatives considered**: Jest (rejeitado — exige configuração adicional de transformação
  para funcionar bem com Vite/ESM, redundante com o que o Vite já oferece); Playwright/Cypress
  para e2e completo (adiado — não incluído no MVP para manter o escopo enxuto; o
  `quickstart.md` cobre a validação manual ponta-a-ponta dos cenários de aceitação; pode ser
  adicionado depois se o projeto crescer).

## 9. Lint e qualidade (gates obrigatórios da constituição)

- **Decision**: ESLint + `typescript-eslint`, com `curly: ["error", "all"]` (Princípio II) e
  `eslint-plugin-jsx-a11y` (Princípio V) configurados como bloqueantes de build/CI.
  `tsconfig.json` com `"strict": true`, `noImplicitAny`, `strictNullChecks`,
  `noUncheckedIndexedAccess` (Princípio I).
- **Rationale**: requisito direto da constituição do projeto, não uma escolha discricionária.
- **Alternatives considered**: N/A — estas regras são MUST da constituição.

## 10. Hospedagem/deploy

- **Decision**: build estático (`vite build`) publicável em qualquer host estático (ex.: GitHub
  Pages, Vercel, Netlify, Cloudflare Pages); nenhuma escolha específica de host é fixada nesta
  fase por não haver requisito explícito do usuário.
- **Rationale**: o app não tem backend próprio (chama a API pública do Open-Meteo diretamente do
  navegador), então qualquer host estático atende. Confirmar em tempo de implementação (primeiro
  passo do `quickstart.md`) que a API do Open-Meteo permite chamadas diretas do navegador
  (CORS) — é o padrão observado em exemplos públicos da própria documentação, mas deve ser
  validado cedo para evitar retrabalho.
- **Alternatives considered**: N/A — decisão de infraestrutura fora do escopo desta fase; sem
  necessidade de servidor teria sido a única alternativa relevante e já é a escolhida.

## Achado durante a implementação (T046 — smoke test manual contra a API real)

Ao testar `OpenMeteoTemperatureDataSource.fetchGrid()` de ponta a ponta contra a API real (fora
da suíte de testes permanente, que não deve depender de rede), uma primeira tentativa disparando
os 7 lotes de 100 coordenadas em paralelo (`Promise.all`) resultou em `HTTP 429` (rate limit) —
mesmo estando bem abaixo do limite diário de 10.000 requisições. Isso confirma na prática a
preocupação original do usuário sobre "não bater num rate limit": o Open-Meteo também aplica um
limite de rajada de curto prazo (por minuto), não só o teto diário.

**Correção aplicada**: `fetchGrid()` agora busca os lotes **sequencialmente** (um `await` por
vez, não `Promise.all`), ao custo de um pouco mais de latência total (~1-3s a mais para a grade
completa) em troca de um uso mais respeitoso da API pública gratuita. Combinado com o intervalo
de refresh de 30 minutos (§6 abaixo), isso mantém o uso bem dentro de qualquer limite razoável de
rajada ou diário.

## Itens validados no início da implementação (T009)

- **CORS**: confirmado. `GET https://api.open-meteo.com/v1/forecast` responde com
  `access-control-allow-origin: *` mesmo com um cabeçalho `Origin` de terceiro — chamadas
  diretas do navegador funcionam sem proxy.
- **Limite de coordenadas por requisição**: não há um teto documentado fixo de 100 como nas
  APIs de geocoding/elevation — testado empiricamente com requisições reais:
  - 100 e 101 coordenadas: `HTTP 200` OK.
  - 200 coordenadas: `HTTP 200` OK.
  - 500 e 1000 coordenadas: `HTTP 414 Request-URI Too Large` (limite de tamanho de URL do
    servidor `nginx`, não um limite de contagem de coordenadas em si).
  - **Decisão**: manter o tamanho de lote em **100 coordenadas por requisição** (bem abaixo do
    ponto de falha observado entre 200 e 500), com folga de segurança independente da precisão
    decimal das coordenadas usadas.
