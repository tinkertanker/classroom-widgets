// setupTests.ts registers the jest-dom matchers on Vitest's `expect`, but the
// v5 typings only extend Jest's matcher interfaces. Extend Vitest's too so
// tests that import `expect` from 'vitest' see the same matchers.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  // Type parameters must match Vitest's own declarations to merge.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends TestingLibraryMatchers<unknown, void> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, void> {}
}
