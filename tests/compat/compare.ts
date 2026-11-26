import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { capture, installRelease, major } from './contract'
import { assertCompatible, canonical, mergeSnapshots } from './policy'

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
        assert.equal(
          after.openapiText,
          before.openapiText,
          'COMPAT_ALPHA71_OPENAPI_BYTES_MISMATCH'
        )
        assert.deepEqual(
          canonical(after.http),
          canonical(before.http),
          'COMPAT_ALPHA71_MISMATCH'
        )
        console.log(
          `COMPAT ALPHA71 PASS: Express ${major}, byte-identical OpenAPI, ${Object.keys(after.http).length} restored/unchanged HTTP cases`
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
        assert.equal(
          compositionalAfter.openapiText,
          compositionalBefore.openapiText,
          'COMPAT_COMPOSITIONAL_ALPHA71_OPENAPI_BYTES_MISMATCH'
        )
        console.log(
          `COMPAT COMPOSITIONAL ALPHA71 PASS: Express ${major}, byte-identical OpenAPI, ${Object.keys(compositionalAfter.http).length} HTTP cases, controller arguments and errors`
        )
        const [controlBefore, controlAfter] = await Promise.all([
          capture(entry, true, 'nonrecursive'),
          capture(undefined, true, 'nonrecursive')
        ])
        assert.deepEqual(controlAfter.http, controlBefore.http)
        assert.equal(
          controlAfter.openapiText,
          controlBefore.openapiText,
          'COMPAT_NONRECURSIVE_ALPHA71_OPENAPI_BYTES_MISMATCH'
        )
        console.log(
          `COMPAT NONRECURSIVE ALPHA71 PASS: Express ${major}, byte-identical OpenAPI, ${Object.keys(controlAfter.http).length} HTTP cases`
        )
      } else {
        const entries = JSON.parse(
          fs.readFileSync(path.join(__dirname, 'accepted-changes.json'), 'utf8')
        )
        const [recursiveBefore, recursiveAfter] = await Promise.all([
          capture(entry, false, 'recursive'),
          capture(undefined, false, 'recursive')
        ])
        let releaseBefore = mergeSnapshots(
          before,
          recursiveBefore,
          'recursive.openapi'
        )
        let releaseAfter = mergeSnapshots(
          after,
          recursiveAfter,
          'recursive.openapi'
        )
        for (const group of [true, 'nonrecursive'] as const) {
          const [documentBefore, documentAfter] = await Promise.all([
            capture(entry, false, group),
            capture(undefined, false, group)
          ])
          const id = `${group === true ? 'compositional' : group}.openapi`
          releaseBefore = mergeSnapshots(releaseBefore, documentBefore, id)
          releaseAfter = mergeSnapshots(releaseAfter, documentAfter, id)
        }
        const count = assertCompatible(
          releaseBefore,
          releaseAfter,
          entries,
          version,
          major
        )
        console.log(
          `COMPAT RELEASE PASS: typoa@${version}, Express ${major}, ${count} exact accepted changes`
        )
        console.log(
          `COMPAT RECURSIVE RELEASE PASS: typoa@${version}, Express ${major}, ${Object.keys(recursiveAfter.http).length} HTTP cases`
        )
      }
    }
  )
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
