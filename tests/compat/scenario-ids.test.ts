import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { capture } from './contract'
import { compositionalScenarios, scenarios } from './cases'

for (const compositional of [false, true]) {
  test(`Duplicate ${compositional ? 'compositional' : 'regular'} scenario IDs reject before capture`, async () => {
    const selected = compositional ? compositionalScenarios : scenarios
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
