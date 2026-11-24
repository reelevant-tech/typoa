import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Inherited readonly nullable fields remain valid after schema intersection', async () => {
  const before = await intermediate('readonly-nullable', false)
  const after = await intermediate('readonly-nullable')
  assertAdditive(before, after)
  await SwaggerParser.validate(structuredClone(after.spec))
  await assertClientCompiles(
    after.spec,
    "import { Combined } from './definitions'\n" +
      "const value: Combined = { data: { id: 'a' }, tags: [] }; void value\n"
  )
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Combined' })
  assert.equal(validate({ data: null, tags: [] }), true)
  assert.equal(validate({ data: { id: 'a' }, tags: [] }), true)
  assert.equal(validate({}), false)
  assert.equal(validate({ data: {}, tags: [] }), false)
  assert.equal(validate({ data: { id: 'a', extra: true }, tags: [] }), false)
  assert.equal(
    after.spec.components.schemas.Combined.properties.data.readOnly,
    true
  )
})
