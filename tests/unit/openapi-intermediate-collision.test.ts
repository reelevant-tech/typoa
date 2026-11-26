import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertAlpha71,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Preserves alpha.71 component reuse for nonrecursive generic inheritance', async () => {
  const before = await intermediate('collision', false)
  const after = await intermediate('collision')
  assertAlpha71('collision', after.spec)
  assert.deepEqual(after, before)
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
