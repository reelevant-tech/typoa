import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { capture, client, major, snapshot } from './contract'

test('Generated-router HTTP, OpenAPI and generated-client compatibility', async () => {
  const actual = await capture()
  snapshot('openapi.json', actual.openapi)
  snapshot(`express-${major}.json`, actual.http)
  await client(actual.openapi)
  await assert.rejects(
    client(actual.openapi, source => {
      const filtered = 'get<WithoutWriteonly<ClientValue>>'
      assert.ok(source.includes(filtered))
      return source.replace(filtered, 'get<ClientValue>')
    }),
    error => {
      assert.ok(error instanceof Error)
      assert.match(
        error.message,
        /Type 'false' is not assignable to type 'true'/
      )
      console.log(
        'COMPAT WRITEONLY NEGATIVE PROBE: unfiltered endpoint response rejected'
      )
      return true
    }
  )
  const required = JSON.parse(JSON.stringify(actual.openapi))
  required.components.schemas.ClientValue.required.push('optional')
  await assert.rejects(client(required), error => {
    assert.ok(error instanceof Error)
    assert.match(error.message, /Property 'optional' is missing/)
    assert.match(error.message, /Type 'true' is not assignable to type 'false'/)
    console.log(
      'COMPAT OPTIONAL NEGATIVE PROBE (expected errors):\n' +
        error.message
          .split('\n')
          .filter(line => /TS2741|TS2322/.test(line))
          .map(line => line.slice(line.indexOf('error TS')))
          .join('\n')
    )
    return true
  })
  console.log(
    `COMPAT PASS: Express ${major}, ${Object.keys(actual.http).length} HTTP cases, OpenAPI snapshot and oatyp/tsc`
  )
})
