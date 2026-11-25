import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import Ajv from 'ajv'
import { generate } from '../../src'
import { assertAlpha71 } from './intermediate-helpers'

test('Keeps alpha.71 schemas with every keepIntermediateSchemas setting', async () => {
  const file = (name: string) =>
    path.resolve(__dirname, `generated-intermediates-${name}`)
  const config = {
    tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
    controllers: [
      path.resolve(__dirname, '../fixtures/validation/intermediate-schemas.ts')
    ],
    openapi: {
      filePath: file('openapi.json'),
      service: { name: 'intermediates', version: '1' }
    },
    router: { filePath: file('router.ts') }
  }
  await generate({
    ...config,
    openapi: { ...config.openapi, keepIntermediateSchemas: false }
  })
  const disabled = JSON.parse(fs.readFileSync(file('openapi.json'), 'utf8'))
  const router = fs.readFileSync(file('router.ts'), 'utf8')
  assertAlpha71('schemas', disabled)
  await generate(config)
  const enabled = JSON.parse(fs.readFileSync(file('openapi.json'), 'utf8'))
  assert.equal(fs.readFileSync(file('router.ts'), 'utf8'), router)
  assert.deepEqual(enabled, disabled)
  await generate({
    ...config,
    openapi: { ...config.openapi, keepIntermediateSchemas: true }
  })
  assert.equal(
    fs.readFileSync(file('openapi.json'), 'utf8'),
    JSON.stringify(enabled, null, '\t')
  )
})

test('Restores recursive bases without replaying closed composition', async () => {
  const filePath = path.resolve(
    __dirname,
    'generated-intermediates-recursive.json'
  )
  await generate({
    tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
    controllers: [
      path.resolve(
        __dirname,
        '../fixtures/validation/runtime-recursive-base.ts'
      )
    ],
    openapi: { filePath, service: { name: 'recursive', version: '1' } },
    router: {
      filePath: path.resolve(__dirname, 'generated-intermediates-recursive.ts')
    }
  })
  const spec = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  assert.deepEqual(spec.components.schemas.RecursiveItem, {
    type: 'object',
    properties: { next: { $ref: '#/components/schemas/RecursiveItem' } },
    additionalProperties: false
  })
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: spec.components }, 'spec')
  const validate = ajv.compile({
    $ref: 'spec#/components/schemas/RecursiveItem'
  })
  assert.equal(validate({}), true)
  assert.equal(validate({ next: { next: {} } }), true)
  assert.equal(validate({ next: { extra: true } }), false)
})

test('Does not add schemas for an empty controller set', async () => {
  const filePath = path.resolve(__dirname, 'generated-intermediates-empty.json')
  await generate({
    tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
    controllers: [],
    openapi: { filePath, service: { name: 'empty', version: '1' } },
    router: {
      filePath: path.resolve(__dirname, 'generated-intermediates-empty.ts')
    }
  })
  assert.deepEqual(
    JSON.parse(fs.readFileSync(filePath, 'utf8')).components.schemas,
    {}
  )
})
