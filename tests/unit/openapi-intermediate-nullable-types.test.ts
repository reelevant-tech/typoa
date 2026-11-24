import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Restored nullable enums and serialized values retain their non-null constraints', async () => {
  const before = await intermediate('nullable-types', false)
  const after = await intermediate('nullable-types')
  assertAdditive(before, after)
  await SwaggerParser.validate(structuredClone(after.spec))
  await assertClientCompiles(
    after.spec,
    "import { Parent } from './definitions'\n" +
      "const value: Parent = { kind: 'second', object: { id: 'a' }, scalar: 'a', list: ['a'] }; void value\n" +
      'const empty: Parent = { kind: null, object: null, scalar: null, list: null }; void empty\n'
  )
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Parent' })
  const valid = {
    kind: 'second',
    object: { id: 'a' },
    scalar: 'a',
    list: ['a']
  }
  assert.equal(validate(valid), true)
  assert.equal(
    validate({ kind: null, object: null, scalar: null, list: null }),
    true
  )
  assert.equal(validate({}), false)
  for (const change of [
    { kind: 'other' },
    { kind: 1 },
    { object: 4 },
    { object: {} },
    { object: { id: 'a', extra: true } },
    { scalar: false },
    { list: 'a' },
    { list: [1] }
  ])
    assert.equal(validate({ ...valid, ...change }), false)
  assert.equal(validate({ ...valid, extra: true }), false)
})
