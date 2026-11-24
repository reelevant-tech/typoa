import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Restored bases do not reuse a narrower instantiation with the same component name', async () => {
  const before = await intermediate('collision', false)
  const after = await intermediate('collision')
  assertAdditive(before, after)
  assert.deepEqual(Object.keys(after.spec.components.schemas).sort(), [
    'Box',
    'Box_Intermediate',
    'Child',
    'Parent'
  ])
  await SwaggerParser.validate(structuredClone(after.spec))
  assert.equal(
    after.spec.components.schemas.Parent.properties.box.description,
    'Primary box'
  )
  assert.equal(
    after.spec.components.schemas.Parent.properties.other.description,
    undefined
  )
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const parent = ajv.compile({ $ref: 'spec#/components/schemas/Parent' })
  const child = ajv.compile({ $ref: 'spec#/components/schemas/Child' })
  for (const value of [1, 2, 42]) assert.equal(parent({ box: { value } }), true)
  assert.equal(parent({ box: { value: 2 }, other: { value: 3 } }), true)
  assert.equal(child({ box: { value: 1 } }), true)
  assert.equal(child({ box: { value: 2 } }), false)
  assert.equal(parent({}), false)
  assert.equal(parent({ box: { value: 'a' } }), false)
  assert.equal(parent({ box: { value: 2, extra: true } }), false)
  assert.equal(parent({ box: { value: 2 }, extra: true }), false)
})

test('Recursive generic collisions use named components that compile in a generated client', async () => {
  const before = await intermediate('recursive-collision', false)
  const after = await intermediate('recursive-collision')
  assertAdditive(before, after)
  await SwaggerParser.validate(structuredClone(after.spec))
  const refs = JSON.stringify(after.spec).match(
    /#\/components\/schemas\/[^"\s]+/g
  )!
  for (const ref of refs)
    assert.equal(ref.slice('#/components/schemas/'.length).includes('/'), false)
  await assertClientCompiles(
    after.spec,
    "import { Parent } from './definitions'\n" +
      'const value: Parent = { box: { value: 2, next: { value: 3 } } }; void value\n'
  )
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Parent' })
  assert.equal(validate({ box: { value: 2 } }), true)
  assert.equal(
    validate({ box: { value: 2, next: { value: 3, next: { value: 4 } } } }),
    true
  )
  assert.equal(validate({}), false)
  assert.equal(validate({ box: { value: 2, next: {} } }), false)
  assert.equal(validate({ box: { value: 2, next: { value: 'a' } } }), false)
  assert.equal(
    validate({ box: { value: 2, next: { value: 3, extra: true } } }),
    false
  )
})
