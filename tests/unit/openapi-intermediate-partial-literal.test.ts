import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Serialized fields of an inline constrained Partial remain optional', async () => {
  const before = await intermediate('partial-literal', false)
  const after = await intermediate('partial-literal')
  assertAdditive(before, after)
  await SwaggerParser.validate(structuredClone(after.spec))
  await assertClientCompiles(
    after.spec,
    "import { Base_T } from './definitions'\nconst value: Base_T = { data: {} }; void value\n"
  )
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Base_T' })
  for (const data of [{}, { id: 'a' }, { count: 1 }, { id: 'a', count: 1 }])
    assert.equal(validate({ data }), true)
  assert.equal(validate({}), false)
  assert.equal(validate({ data: { id: 1 } }), false)
  assert.equal(validate({ data: 'a' }), false)
})
