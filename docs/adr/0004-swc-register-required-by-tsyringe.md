# tsyringe requires `emitDecoratorMetadata`, so the api runs on `@swc-node/register`

The api package runs TypeScript through `@swc-node/register` (with `legacyDecorator` and `decoratorMetadata` enabled) and builds with `tsc`.
The obvious modernisations — `node --test src/**/*.ts` using Node's native type stripping, or `tsx` — both fail, and it is worth recording
why so nobody spends an afternoon rediscovering it.

## Considered options

- **Node native type stripping**: rejects the code outright. Node's docs state decorators "are not transformed and will result in a parser
  error", and parameter properties (`constructor(private readonly x: X) {}`, used throughout) are likewise unsupported.
- **tsx**: runs on esbuild, whose docs state `emitDecoratorMetadata` is "not supported… esbuild does not replicate TypeScript's type
  system". This is the dangerous option: the code _runs_, then tsyringe fails at **runtime** with an opaque resolution error, because the
  emitted metadata is exactly what lets a concrete-class dependency resolve without an injection token.
- **Drop tsyringe on the backend** and wire constructors by hand. Viable, and it would free every toolchain — rejected to keep one
  dependency-injection model across both packages.
- **`@swc-node/register`**: supports `decoratorMetadata`, so dev, test, and production behave identically. Chosen.

`node:test` remains the test runner; SWC is the loader, not the runner.
