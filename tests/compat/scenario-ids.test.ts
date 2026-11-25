import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { capture } from './contract'
import { markLegacy, scenarioGroup, scenariosFor, type Scenario } from './cases'

test('Legacy classification rejects conflicting inline markers', () => {
  const scenario: Scenario = { id: 'item', path: 'item' }
  markLegacy(scenario, true)
  assert.equal(scenario.legacy, true)
  markLegacy(scenario, true)
  assert.throws(
    () => markLegacy(scenario, false),
    /Conflicting legacy marker: item/
  )
  assert.throws(
    () => markLegacy({ id: 'other', path: 'other', legacy: false }, true),
    /Conflicting legacy marker: other/
  )
})

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
