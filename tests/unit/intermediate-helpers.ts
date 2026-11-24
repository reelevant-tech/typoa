import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { generate } from '../../src'

export async function intermediate(
  fixture: string,
  keepIntermediateSchemas = true
) {
  const file = (suffix: string) =>
    path.resolve(__dirname, `generated-review-${fixture}.${suffix}`)
  await generate({
    tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
    controllers: [
      path.resolve(
        __dirname,
        `../fixtures/validation/intermediate-${fixture}.ts`
      )
    ],
    openapi: {
      filePath: file('json'),
      keepIntermediateSchemas,
      service: { name: 'generic', version: '1' }
    },
    router: { filePath: file('ts') }
  })
  return {
    spec: JSON.parse(fs.readFileSync(file('json'), 'utf8')),
    router: fs.readFileSync(file('ts'), 'utf8')
  }
}

export function assertAdditive(before: any, after: any) {
  assert.equal(after.router, before.router)
  const stripped = structuredClone(after.spec)
  stripped.components.schemas = Object.fromEntries(
    Object.keys(before.spec.components.schemas).map(name => [
      name,
      after.spec.components.schemas[name]
    ])
  )
  assert.deepEqual(stripped, before.spec)
}
