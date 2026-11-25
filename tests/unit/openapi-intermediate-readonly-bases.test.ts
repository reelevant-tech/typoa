import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Restored multiple bases with readonly recursive generics remain serializable', async () => {
  const before = await intermediate('readonly-bases', false)
  const after = await intermediate('readonly-bases')
  assertAdditive(before, after)
  await SwaggerParser.validate(structuredClone(after.spec))
  await assertClientCompiles(
    after.spec,
    "import { Combined } from './definitions'\n" +
      'const value: Combined = { box: { value: 2, next: { value: 3 } }, tags: [] }; void value\n'
  )
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Combined' })
  assert.equal(
    validate({ box: { value: 2, next: { value: 3 } }, tags: [] }),
    true
  )
  assert.equal(validate({}), false)
  assert.equal(validate({ box: { value: 2, next: {} }, tags: [] }), false)
  assert.equal(
    validate({ box: { value: 2, next: { value: 3, extra: true } }, tags: [] }),
    false
  )
  assert.equal(
    after.spec.components.schemas.Combined.properties.box.readOnly,
    true
  )
  const reference =
    after.spec.components.schemas.Combined.properties.box.allOf[0].$ref
  assert.equal(
    after.spec.components.schemas[reference.split('/').pop()!].readOnly,
    undefined
  )
})
