import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertAlpha71, intermediate } from './intermediate-helpers'

test('Preserves alpha.71 inherited readonly nullable schemas', async () => {
  const before = await intermediate('readonly-nullable', false)
  const after = await intermediate('readonly-nullable')
  assertAlpha71('readonly-nullable', after.spec)
  assert.deepEqual(after, before)
})
