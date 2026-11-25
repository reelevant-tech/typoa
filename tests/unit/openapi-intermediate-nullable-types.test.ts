import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertAlpha71, intermediate } from './intermediate-helpers'

test('Preserves alpha.71 nullable enum and serialized schemas', async () => {
  const before = await intermediate('nullable-types', false)
  const after = await intermediate('nullable-types')
  assertAlpha71('nullable-types', after.spec)
  assert.deepEqual(after, before)
})
