import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { capture, installRelease, major, snapshot } from './contract'

test('Compositional request acceptance and controller arguments match alpha.71', async () => {
  const after = await capture(undefined, false, true)
  snapshot('compositional-openapi.json', after.openapi)
  await installRelease('1.0.0-alpha.71', async entry => {
    const before = await capture(entry, true, true)
    snapshot(`compositional-express-${major}.json`, before.http)
    assert.deepEqual(after.http, before.http)
    console.log(
      `COMPOSITIONAL PASS: Express ${major}, ${Object.keys(after.http).length} HTTP cases, alpha.71 controller arguments and errors`
    )
  })
})
