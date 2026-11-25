import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { capture } from './contract'
import { scenarioGroup, scenariosFor } from './cases'

for (const compositional of [
  false,
  true,
  'recursive',
  'nonrecursive'
] as const) {
  test(`Duplicate ${scenarioGroup(compositional)} scenario IDs reject before capture`, async () => {
    const selected = scenariosFor(scenarioGroup(compositional))
    selected.push({ ...selected[0], path: 'duplicate' })
    try {
      await assert.rejects(
        capture(undefined, false, compositional),
        /Duplicate scenario IDs/
      )
    } finally {
      selected.pop()
    }
  })
}
