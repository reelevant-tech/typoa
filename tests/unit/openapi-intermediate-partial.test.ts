import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertAlpha71, intermediate } from './intermediate-helpers'

test('Preserves alpha.71 Partial schemas for unbound parameters', async () => {
  const before = await intermediate('partial', false)
  const after = await intermediate('partial')
  assertAlpha71('partial', after.spec)
  assert.deepEqual(after, before)
})
