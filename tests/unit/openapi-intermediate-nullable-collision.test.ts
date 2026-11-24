import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Nullable recursive children do not make parents or siblings nullable', async () => {
  const before = await intermediate('nullable-collision', false)
  const after = await intermediate('nullable-collision')
  assertAdditive(before, after)
  await SwaggerParser.validate(structuredClone(after.spec))
  await assertClientCompiles(
    after.spec,
    "import { Parent } from './definitions'\n" +
      'const value: Parent = { box: { value: 2, next: null, sibling: { value: 3, next: null } } }; void value\n' +
      '// @ts-expect-error the parent is not nullable\nconst parent: Parent = { box: null }; void parent\n' +
      '// @ts-expect-error siblings are not nullable\nconst sibling: Parent = { box: { value: 2, sibling: null } }; void sibling\n'
  )
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({ $ref: 'spec#/components/schemas/Parent' })
  assert.equal(validate({ box: { value: 2, next: null } }), true)
  assert.equal(
    validate({
      box: { value: 2, next: { value: 3, next: null }, sibling: { value: 4 } }
    }),
    true
  )
  assert.equal(validate({}), false)
  assert.equal(validate({ box: null }), false)
  assert.equal(validate({ box: { value: 2, sibling: null } }), false)
  assert.equal(validate({ box: { value: 2, next: {} } }), false)
  assert.equal(
    validate({ box: { value: 2, next: { value: 3, extra: true } } }),
    false
  )
})
