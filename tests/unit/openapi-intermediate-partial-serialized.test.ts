import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertAlpha71, intermediate } from './intermediate-helpers'

test('Preserves alpha.71 constrained serialized Partial schemas', async () => {
  const before = await intermediate('partial-serialized', false)
  const after = await intermediate('partial-serialized')
  assertAlpha71('partial-serialized', after.spec)
  assert.deepEqual(after, before)
})
