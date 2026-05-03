import { defineConfig } from 'vitest/config'

// Excluding dist/** here keeps Vitest from picking up emitted test files
// when a contributor has built locally. Without it, stale dist/**/*.test.js
// gets discovered alongside the source tests and runs twice (or worse,
// passes against an outdated build).
export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  },
})
