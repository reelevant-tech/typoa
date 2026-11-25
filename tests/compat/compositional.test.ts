import { test } from 'node:test'
import { capture, major, snapshot } from './contract'

test('Compositional request acceptance and controller arguments match alpha.71', async () => {
  const after = await capture(undefined, false, true)
  snapshot('compositional-openapi.json', after.openapi)
  snapshot(`compositional-express-${major}.json`, after.http)
  console.log(
    `COMPOSITIONAL PASS: Express ${major}, ${Object.keys(after.http).length} HTTP cases, alpha.71 controller argument and error snapshots`
  )
})
