// Runtime environment validation — see AI-CONTRIBUTOR-SPECIFICATION.md §10.
// Parses process.env once at boot and fails fast with an actionable error
// if required variables are missing or malformed.

import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

const parsed = Env.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration:', z.treeifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
export type Env = z.infer<typeof Env>
