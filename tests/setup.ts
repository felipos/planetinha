import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// `vitest.config.ts` usa `globals: false`, então o auto-cleanup do RTL (que depende de detectar
// `afterEach` no escopo global) não é acionado sozinho — sem isso, DOM de um teste vaza para o
// próximo dentro do mesmo arquivo, quebrando qualquer `getByRole`/query no `document` inteiro.
afterEach(() => {
  cleanup()
})
