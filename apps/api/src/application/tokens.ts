/**
 * tsyringe injection tokens for ports (interfaces have no runtime representation, so an
 * interface-typed dependency needs a token to register/resolve a concrete implementation
 * against). A dependency typed as a concrete class needs no token.
 */
export const TOKENS = {
  SnapshotRepositoryPort: Symbol('SnapshotRepositoryPort'),
} as const
