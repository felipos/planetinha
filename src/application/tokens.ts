/**
 * tsyringe injection tokens for ports (interfaces have no runtime representation, so an
 * interface-typed dependency needs a token to register/resolve a concrete implementation
 * against).
 */
export const TOKENS = {
  TemperatureDataSourcePort: Symbol('TemperatureDataSourcePort'),
} as const
