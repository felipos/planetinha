# Contrato interno: TemperatureDataSourcePort

Interface (port) definida pela camada **Use Cases** e implementada pela camada **Data Sources**
(Princípio III — inversão de dependência na fronteira entre camadas). É o único ponto de
acoplamento entre a lógica de aplicação e a API externa do Open-Meteo.

```ts
interface TemperatureGridRequest {
  readonly resolutionDegrees: number; // espaçamento da grade lat/long a buscar
}

interface TemperatureDataSourcePort {
  // `signal`, se abortado, MUST interromper requisições/esperas em andamento e rejeitar com um
  // DOMException `AbortError` — usado pela Presentation para cancelar uma busca obsoleta sem
  // gastar cota da API à toa (ex.: double-invoke do StrictMode em dev, desmontagem real).
  fetchGrid(request: TemperatureGridRequest, signal?: AbortSignal): Promise<TemperatureGrid>;
}
```

- `TemperatureGrid` conforme `data-model.md`.
- A implementação concreta (`OpenMeteoTemperatureDataSource`, camada Data Sources) é responsável
  por: gerar os pontos de grade a partir de `resolutionDegrees`, dividir em lotes de até N
  coordenadas (ver `open-meteo-forecast-request.md`), disparar as requisições HTTP com throttle
  entre lotes e retry/backoff em `HTTP 429` (ver `open-meteo-forecast-request.md`), normalizar a
  resposta (objeto único vs array) e mapear erros de rede/HTTP/`error:true` para uma rejeição da
  Promise com uma mensagem de erro apta a ser exibida ao usuário (Edge Case do spec: nunca falhar
  silenciosamente) — exceto um cancelamento via `signal`, que MUST rejeitar com `AbortError` em
  vez disso, para a Presentation distinguir "cancelado de propósito" de "falhou de verdade".
- **Use Cases não sabem nada sobre `fetch`, URLs, formato JSON do Open-Meteo, batching, ou
  CORS** — apenas chamam `fetchGrid()` e recebem `TemperatureGrid` ou uma rejeição. Isso permite
  trocar a fonte de dados (ex.: outro provedor meteorológico, ou um proxy/backend futuro
  mencionado em `research.md` §6) sem tocar em Domain/Use Cases.

## Consumidor: FetchTemperatureGridUseCase

```ts
interface FetchTemperatureGridUseCase {
  execute(signal?: AbortSignal): Promise<TemperatureGrid>; // usa TemperatureDataSourcePort internamente
}
```

- Chamado uma vez no carregamento da página e depois a cada `TEMPERATURE_REFRESH_INTERVAL_MS`
  (30 minutos, ver `research.md` §6) por um hook da camada Presentation.
- Em caso de falha, a camada Presentation MUST preservar o último `TemperatureGrid` bem-sucedido
  (`DataFetchStatus.kind === "stale-error"`) em vez de limpar a visualização.
