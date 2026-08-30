# Data Model: Globo de Temperatura Global em Tempo Real

Entidades derivadas de `spec.md` (Key Entities) e das decisões de `research.md`. Tipos em
TypeScript, camada **Domain** (Princípio III — sem dependência de framework/UI/infra).

## TemperatureReading

Representa a temperatura em uma coordenada geográfica em um dado momento (Key Entity "Leitura de
Temperatura" do spec).

```ts
interface TemperatureReading {
  readonly latitude: number;     // -90..90
  readonly longitude: number;    // -180..180
  readonly temperatureCelsius: number | null; // null = sem dado disponível (edge case do spec)
  readonly observedAt: string;   // ISO 8601, timestamp reportado pela fonte
}
```

- **Regras de validação**: `latitude` MUST estar em `[-90, 90]`; `longitude` MUST estar em
  `[-180, 180]`. `temperatureCelsius === null` representa explicitamente "sem dado" (FR: nunca
  exibir cor enganosa para pontos sem dado — Edge Cases do spec) e MUST ser tratado de forma
  distinta de `0` (zero graus é um valor válido).
- **Ciclo de vida**: imutável; um novo fetch produz um novo conjunto de `TemperatureReading`,
  substituindo o anterior por completo (sem merge parcial).

## TemperatureGrid

Agregado com todas as leituras da atualização mais recente (unidade de trabalho do Use Case de
"buscar/atualizar dados").

```ts
interface TemperatureGrid {
  readonly readings: readonly TemperatureReading[];
  readonly fetchedAt: string;        // ISO 8601 — quando este grid foi obtido pelo cliente
  readonly resolutionDegrees: number; // espaçamento da grade lat/long usado nesta busca
}
```

- **Regra de idade do dado**: a "idade" exibível ao usuário (FR: horário/idade do dado) é
  derivada de `fetchedAt` (quando o cliente buscou) combinada com `observedAt` de cada leitura
  (quando a fonte diz que o dado é válido) — usar o mais antigo relevante para a mensagem de
  staleness quando a fonte estiver indisponível (ver `DataFetchStatus`).

## DataFetchStatus

Representa o estado de carregamento/erro da busca de dados (suporta os Edge Cases de API
indisponível e conexão lenta do spec).

```ts
type DataFetchStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; grid: TemperatureGrid }
  | { kind: "stale-error"; lastGood: TemperatureGrid; errorMessage: string }
  // erro na primeira busca: nunca houve dado bom para mostrar
  | { kind: "hard-error"; errorMessage: string };
```

- **Transições**: `idle → loading → (success | hard-error)`; a partir de `success`, uma nova
  tentativa de refresh que falhe vai para `stale-error` (mantém `lastGood` visível, conforme
  Edge Case "manter a última visualização válida" do spec) em vez de `hard-error`. Uma nova
  tentativa bem-sucedida a partir de `stale-error` ou `hard-error` volta para `success`.

## GlobeViewState

Estado efêmero de câmera do globo (Key Entity "Estado da Visualização do Globo" do spec) — não
persistido entre sessões.

```ts
interface GlobeViewState {
  readonly rotation: { readonly lat: number; readonly lon: number }; // graus
  readonly zoomDistance: number; // distância da câmera ao centro do globo
}
```

- Vive inteiramente na camada de Presentation (estado de UI, não é regra de negócio).

## SelectedPoint

Representa o ponto que o usuário tocou/clicou para inspeção (User Story 3).

```ts
interface SelectedPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly temperatureCelsius: number | null; // interpolado a partir do TemperatureGrid mais recente
  readonly isInterpolated: boolean; // true quando não há leitura exata naquele ponto de grade
}
```

- **Derivação**: calculado a partir de `TemperatureGrid.readings` via a mesma interpolação usada
  para a textura do heatmap (ver `research.md` §4), não é armazenado como estado persistente —
  recalculado a cada seleção.

## Relações

```text
TemperatureGrid 1 ── * TemperatureReading
DataFetchStatus ──── (contém) ──── TemperatureGrid (quando success/stale-error)
SelectedPoint ──── (derivado de) ──── TemperatureGrid.readings
GlobeViewState ──── (independente, apenas UI) ──── —
```

## Mapeamento de camadas (Princípio III)

- **Domain**: `TemperatureReading`, `TemperatureGrid`, `SelectedPoint` (tipos + funções puras de
  validação/interpolação/color-mapping).
- **Use Cases**: `FetchTemperatureGridUseCase` (orquestra busca periódica, produz `DataFetchStatus`,
  depende apenas da interface `TemperatureDataSourcePort`, ver `contracts/`), `SelectPointUseCase`
  (dado lat/long + grid atual, retorna `SelectedPoint`).
- **Data Sources**: implementação concreta de `TemperatureDataSourcePort` que chama a API do
  Open-Meteo (ver `contracts/open-meteo-forecast-request.md`).
- **Presentation**: `GlobeViewState`, componentes React (globo, legenda, tooltip/painel de
  inspeção, indicador de loading/erro), hooks que consomem os Use Cases.
