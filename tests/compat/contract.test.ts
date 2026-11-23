import { test } from 'node:test'
import { capture, client, major, snapshot } from './contract'

test('Generated-router HTTP, OpenAPI and generated-client compatibility', async () => {
  const actual = await capture()
  snapshot('openapi.json', actual.openapi)
  snapshot(`express-${major}.json`, actual.http)
  await client(actual.openapi)
  console.log(
    `COMPAT PASS: Express ${major}, ${Object.keys(actual.http).length} HTTP cases, OpenAPI snapshot and oatyp/tsc`
  )
})
