import 'reflect-metadata'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// `vitest.config.ts` uses `globals: false`, so RTL's auto-cleanup (which relies on detecting
// `afterEach` in global scope) isn't triggered on its own — without this, DOM from one test
// leaks into the next within the same file, breaking any `getByRole`/query against the whole
// `document`.
afterEach(() => {
  cleanup()
})
