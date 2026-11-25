import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { strict as assert } from 'node:assert'
import { generate as generateClient } from 'oatyp'
import { generate } from '../../src'

export function assertAlpha71(fixture: string, spec: any) {
  const expected = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        `../fixtures/alpha71-openapi/intermediate-${fixture}.json`
      ),
      'utf8'
    )
  )
  assert.deepEqual({ ...spec, info: expected.info }, expected)
}

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

export async function assertClientCompiles(spec: any, source: string) {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'intermediate-client-'))
  try {
    const openapiFilePath = path.join(directory, 'schema.json')
    fs.writeFileSync(openapiFilePath, JSON.stringify(spec))
    await generateClient({ outDir: directory, openapiFilePath })
    const file = path.join(directory, 'usage.ts')
    fs.writeFileSync(file, source)
    execFileSync(process.execPath, [
      require.resolve('typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target',
      'es2022',
      '--moduleResolution',
      'node',
      file
    ])
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}
