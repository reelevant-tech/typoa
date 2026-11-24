import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import { assertAdditive, intermediate } from './intermediate-helpers'

test('Restored bases do not reuse a narrower instantiation with the same component name', async () => {
  const before = await intermediate('collision', false)
  const after = await intermediate('collision')
  assertAdditive(before, after)
  assert.deepEqual(Object.keys(after.spec.components.schemas).sort(), [
    'Box',
    'Child',
    'Parent'
  ])
  await SwaggerParser.validate(structuredClone(after.spec))
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const parent = ajv.compile({ $ref: 'spec#/components/schemas/Parent' })
  const child = ajv.compile({ $ref: 'spec#/components/schemas/Child' })
  for (const value of [1, 2, 42]) assert.equal(parent({ box: { value } }), true)
  assert.equal(child({ box: { value: 1 } }), true)
  assert.equal(child({ box: { value: 2 } }), false)
  assert.equal(parent({}), false)
  assert.equal(parent({ box: { value: 'a' } }), false)
  assert.equal(parent({ box: { value: 2, extra: true } }), false)
  assert.equal(parent({ box: { value: 2 }, extra: true }), false)
})
