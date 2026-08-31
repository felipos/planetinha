/**
 * Composition root's DI wiring: the only place allowed to call `container.register*`. Concrete
 * classes (`Clock`, use cases) need no registration at all — tsyringe resolves them directly
 * from the decorator metadata emitted for their constructor. Only a port, whose interface has
 * no runtime representation, needs a token registered against an implementation.
 */
export class DiContainer {
  static setup(): void {
    // Nothing to register yet: every dependency so far is a concrete class.
  }
}
