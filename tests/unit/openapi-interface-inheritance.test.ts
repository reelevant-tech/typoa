import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { before, describe, test } from 'node:test'
import { generate } from '../../src'
import expected from '../fixtures/alpha71-openapi/interface-inheritance-test.json'

describe('Alpha.71 interface inheritance', () => {
  let spec: typeof expected
  before(async () => {
    const filePath = path.resolve(
      __dirname,
      'generated-openapi-interface-inheritance-test.json'
    )
    await generate({
      tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
      controllers: [
        path.resolve(
          __dirname,
          '../fixtures/validation/interface-inheritance-test.ts'
        )
      ],
      openapi: { filePath, service: { name: 'generic', version: '1' } },
      router: {
        filePath: path.resolve(
          __dirname,
          'generated-router-interface-inheritance.ts'
        )
      }
    })
    spec = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  })
  test('Preserves the complete alpha.71 document', () =>
    assert.deepEqual(spec, expected))
  for (const name of Object.keys(expected.components.schemas)) {
    test(`Preserves the alpha.71 composition of ${name}`, () => {
      assert.deepEqual(
        spec.components.schemas[name as keyof typeof spec.components.schemas],
        expected.components.schemas[
          name as keyof typeof expected.components.schemas
        ]
      )
    })
  }
})
