import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import {
  assertAdditive,
  assertClientCompiles,
  intermediate
} from './intermediate-helpers'

test('Auxiliary generic names do not replace a restored component with the same name', async () => {
  const before = await intermediate('reserved-names', false)
  const after = await intermediate('reserved-names')
  assertAdditive(before, after)
  await SwaggerParser.validate(structuredClone(after.spec))
  await assertClientCompiles(
    after.spec,
    "import { Box_Intermediate, Parent } from './definitions'\n" +
      'const tags: Box_Intermediate = { tags: [] }; const value: Parent = { ...tags, box: { value: 2 } }; void value\n'
  )
  const ajv = new Ajv({ strict: false })
  ajv.addSchema({ components: after.spec.components }, 'spec')
  const validate = ajv.compile({
    $ref: 'spec#/components/schemas/Box_Intermediate'
  })
  assert.equal(validate({ tags: [] }), true)
  assert.equal(validate({}), false)
  assert.equal(validate({ box: { value: 1 } }), false)
  const parent = ajv.compile({ $ref: 'spec#/components/schemas/Parent' })
  assert.equal(parent({ tags: [], box: { value: 2 } }), true)
})
