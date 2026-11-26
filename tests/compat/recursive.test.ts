import { test } from 'node:test'
import { capture, major, snapshot } from './contract'

for (const fixture of ['recursive', 'nonrecursive'] as const) {
  test(`${fixture} HTTP acceptance and controller arguments match their release snapshots`, async () => {
    const result = await capture(undefined, false, fixture)
    snapshot(`${fixture}-openapi.json`, result.openapi)
    snapshot(`${fixture}-express-${major}.json`, result.http)
    console.log(
      `COMPAT ${fixture.toUpperCase()} PASS: Express ${major}, ${Object.keys(result.http).length} HTTP cases`
    )
  })
}
