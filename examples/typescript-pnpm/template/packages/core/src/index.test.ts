import { describe, expect, it } from 'vitest'

import { hello } from './index.js'

describe('hello', () => {
  it('greets the provided name', () => {
    expect(hello('ai-contributors')).toBe('Hello, ai-contributors!')
  })
})
