# Contrato externo: Open-Meteo Forecast API

Fonte: Context7 MCP, library `/websites/open-meteo_en` (consultado em 2026-08-29). Este é o
único contrato externo do sistema — não há backend próprio nem outra integração.

## Endpoint

```text
GET https://api.open-meteo.com/v1/forecast
```

## Query Parameters usados

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `latitude` | float ou lista separada por vírgula | Sim | Coordenadas WGS84. Múltiplas localizações por requisição (lote). |
| `longitude` | float ou lista separada por vírgula | Sim | Idem, na mesma ordem de `latitude`. |
| `current` | string | Sim | `temperature_2m` — condição atual (deriva do dado horário mais recente do modelo). |
| `temperature_unit` | string | Não (default `celsius`) | Fixar `celsius` explicitamente. |
| `timeformat` | string | Não (default `iso8601`) | Fixar `iso8601` explicitamente. |

Sem `apikey` — uso não-comercial, sem chave necessária (ver `research.md` §5 e §6 para limites).

## Lote de múltiplas localizações

- `latitude`/`longitude` aceitam listas separadas por vírgula (ex.:
  `latitude=10,20,30&longitude=-40,-50,-60`), na mesma ordem posicional.
- **Validado empiricamente (T009)**: não há um teto fixo documentado de contagem de
  coordenadas — o limite real observado é o tamanho da URL da requisição (`HTTP 414` do
  `nginx` entre 200 e 500 coordenadas). O data source usa lotes de **100 coordenadas por
  requisição**, com folga de segurança confortável. Ver `research.md` para os números exatos
  testados.

## Formato de resposta (lote — múltiplas localizações)

Quando múltiplas localizações são requisitadas, a resposta é um **array** de objetos, um por
localização, na mesma ordem da requisição:

```json
[
  {
    "latitude": 10.0,
    "longitude": -40.0,
    "generationtime_ms": 0.1,
    "utc_offset_seconds": 0,
    "timezone": "GMT",
    "current_units": { "temperature_2m": "°C" },
    "current": {
      "time": "2026-08-29T12:00",
      "temperature_2m": 24.3
    }
  }
]
```

- Para uma única localização, a resposta é um único objeto (não um array) — o data source MUST
  normalizar ambos os formatos para `TemperatureReading[]`.
- `current.temperature_2m` pode retornar `null` quando o modelo não tem dado para a coordenada
  (ex.: célula de grade inválida) — mapear diretamente para
  `TemperatureReading.temperatureCelsius = null` (ver `data-model.md`).

## Erros

```json
{ "error": true, "reason": "descrição do erro" }
```

- HTTP 400 para parâmetros inválidos (ex.: latitude fora de `[-90, 90]`).
- Qualquer erro de rede, HTTP não-2xx, ou `error: true` no corpo MUST propagar como falha do
  `TemperatureDataSourcePort` (ver contrato interno) — nunca lançar exceção não tratada até a UI.

## Limites de uso (não-comercial, sem `apikey`)

- Limite documentado: **10.000 requisições/dia**. Uma requisição em lote com N localizações conta
  como **múltiplas** chamadas contra esse limite (não como 1) — ver `research.md` §6 para o
  raciocínio completo por trás do intervalo de refresh escolhido (30 minutos).
- Chamadas ao endpoint de metadata (`/model-metadata`) são excluídas do limite — não relevante
  para o fluxo principal deste app, mas útil se o app quiser exibir a hora exata da última
  atualização do modelo no futuro.

## HTTP 429 (rate limit de rajada)

- Observado empiricamente (`research.md`, achado T046): além do teto diário, o Open-Meteo aplica
  um limite de rajada por minuto não documentado. `OpenMeteoTemperatureDataSource` trata isso em
  duas frentes:
  - Um delay mínimo (`BATCH_THROTTLE_MS`) é aplicado entre lotes consecutivos, além de buscá-los
    sequencialmente (não em paralelo).
  - Um `HTTP 429` isolado tenta de novo com backoff exponencial + jitter (até
    `MAX_RETRIES_ON_RATE_LIMIT` tentativas), respeitando o cabeçalho `Retry-After` quando presente
    em vez do backoff calculado.
- Só depois de esgotar as tentativas um `429` vira uma rejeição da Promise (ver contrato interno).

## CORS

- **Validado empiricamente (T009)**: o endpoint responde com `access-control-allow-origin: *`,
  permitindo chamadas diretas do navegador sem necessidade de proxy — confirma a decisão de
  "sem backend" do `research.md` §10.
