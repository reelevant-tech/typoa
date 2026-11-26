import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertAlpha71, intermediate } from './intermediate-helpers'

test('Preserves alpha.71 component names for generic aliases', async () => {
  const before = await intermediate('reserved-names', false)
  const after = await intermediate('reserved-names')
  assertAlpha71('reserved-names', after.spec)
  assert.deepEqual(after, before)
})
