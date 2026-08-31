# The backend is the only client of Open-Meteo

Every call to Open-Meteo is made by a single worker process; the frontend never contacts it, not even as a fallback. Rate-limit discipline
only works if exactly one thing is counting, and the previous design — every browser tab sweeping the planet for itself — multiplied one
client's Budget by the number of open tabs.

## Consequences

- The worker runs as its own container rather than as a Fastify plugin, sharing the api image with a different entrypoint. Scaling the API
  to several replicas therefore cannot accidentally produce several Sweepers.
- The frontend has **no fallback path to Open-Meteo**, and this is deliberate. A client-side fallback sounds like resilience but fires
  exactly when the backend is unavailable — that is, on every client simultaneously — recreating the original burst that this decision
  exists to prevent. `OpenMeteoTemperatureDataSource` was deleted rather than demoted.
- Batching, pacing, and 429 backoff moved out of the browser into the api package, where the only caller lives.
- The frontend's data source now talks to `/global-temp` and knows nothing about any weather provider, which is what lets the provider be
  replaced without touching presentation code.
