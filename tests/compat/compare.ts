import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { capture, installRelease, major } from './contract'
import { assertCompatible, canonical } from './policy'

async function main() {
  const legacy = process.argv.includes('--legacy')
  await installRelease(
    legacy ? '1.0.0-alpha.71' : 'latest',
    async (entry, version) => {
      const [before, after] = await Promise.all([
        capture(entry, legacy),
        capture(undefined, legacy)
      ])
      assert.notEqual(before.runtime.entry, after.runtime.entry)
      console.log(
        `COMPAT RUNTIME: npm ${version}=${before.runtime.hash}; working tree=${after.runtime.hash}; import=typoa/runtime`
      )
      if (legacy) {
        assert.deepEqual(
          canonical(after.http),
          canonical(before.http),
          'COMPAT_ALPHA71_MISMATCH'
        )
        console.log(
          `COMPAT ALPHA71 PASS: Express ${major}, ${Object.keys(after.http).length} restored/unchanged HTTP cases`
        )
        const [compositionalBefore, compositionalAfter] = await Promise.all([
          capture(entry, true, true),
          capture(undefined, true, true)
        ])
        assert.notEqual(
          compositionalBefore.runtime.entry,
          compositionalAfter.runtime.entry
        )
        assert.deepEqual(
          canonical(compositionalAfter.http),
          canonical(compositionalBefore.http),
          'COMPAT_COMPOSITIONAL_ALPHA71_MISMATCH'
        )
        console.log(
          `COMPAT COMPOSITIONAL ALPHA71 PASS: Express ${major}, ${Object.keys(compositionalAfter.http).length} HTTP cases, controller arguments and errors`
        )
      } else {
        const entries = JSON.parse(
          fs.readFileSync(path.join(__dirname, 'accepted-changes.json'), 'utf8')
        )
        const count = assertCompatible(before, after, entries, version, major)
        console.log(
          `COMPAT RELEASE PASS: typoa@${version}, Express ${major}, ${count} exact accepted changes`
        )
      }
    }
  )
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
