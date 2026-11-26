import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { assertAlpha71, intermediate } from './intermediate-helpers'

test('Preserves alpha.71 generic key and indexed-access schemas', async () => {
  const before = await intermediate('indexed', false)
  const after = await intermediate('indexed')
  assertAlpha71('indexed', after.spec)
  assert.deepEqual(after, before)
})
