import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import { assertAdditive, intermediate } from './intermediate-helpers'

test('A restored Partial of an unbound parameter allows concrete instantiations', async () => {
  const before = await intermediate('partial', false)
  const after = await intermediate('partial')
  assertAdditive(before, after)
  for (const name of ['T_Partial', 'Base_T', 'Envelope_Item', 'Result'])
    assert.ok(after.spec.components.schemas[name], name)
  await SwaggerParser.validate(structuredClone(after.spec))
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Base_T' })
  for (const data of [
    {},
    { id: 'a' },
    { count: 2 },
    { id: 'a', count: 2 },
    { other: true }
  ])
    assert.equal(validate({ data }), true)
  assert.equal(validate({}), false)
  assert.equal(validate({ data: 1 }), false)
  assert.equal(validate({ data: { id: 'a' }, extra: true }), false)
  const concrete = ajv.compile({
    $ref: 'spec#/components/schemas/Item_Partial'
  })
  assert.equal(concrete({ id: 'a' }), true)
  assert.equal(concrete({}), true)
  assert.equal(concrete({ other: true }), false)
  assert.equal(concrete({ id: 1 }), false)
})
