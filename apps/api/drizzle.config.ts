import { defineConfig } from 'drizzle-kit'

// `drizzle-kit generate` only reads the schema and writes SQL into ./migrations; applying those
// files is `npm run db:migrate`, which needs the connection string and this config does not.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/datasource/db/entities/schema.ts',
  out: './migrations',
})
