import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Auxiliary names reserve enums emitted only by a restored base', async () => {
  const before = await intermediate('reserved-enum', false)
  const after = await intermediate('reserved-enum')
  assertAdditive(before, after)
  await SwaggerParser.validate(structuredClone(after.spec))
  await assertClientCompiles(
    after.spec,
    "import { Box_Intermediate, Parent } from './definitions'\n" +
      'const value: Parent = { box: { value: 2 }, kind: Box_Intermediate.FIRST }; void value\n'
  )
  assert.deepEqual(after.spec.components.schemas.Box_Intermediate, {
    type: 'string',
    enum: ['first', 'second']
  })
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Parent' })
  assert.equal(validate({ box: { value: 2 }, kind: 'first' }), true)
  assert.equal(validate({ box: { value: 3 }, kind: 'second' }), true)
  assert.equal(validate({}), false)
  assert.equal(validate({ box: { value: 2 }, kind: { value: 3 } }), false)
  assert.equal(validate({ box: { value: 'a' }, kind: 'first' }), false)
})
