import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import { assertAdditive, intermediate } from './intermediate-helpers'

test('Restored generic key and indexed access types form a valid OpenAPI document', async () => {
  const before = await intermediate('indexed', false)
  const after = await intermediate('indexed')
  assertAdditive(before, after)
  const schemas = after.spec.components.schemas
  for (const name of ['Selection_T', 'Envelope_Item', 'Selected'])
    assert.ok(schemas[name], name)
  await SwaggerParser.validate(structuredClone(after.spec))
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Selection_T' })
  assert.equal(validate({ key: 'count', id: 'a' }), true)
  assert.equal(validate({}), false)
  assert.equal(validate({ key: 'id', id: 1 }), false)
  assert.equal(validate({ key: 'id', id: 'a', extra: true }), false)
})
