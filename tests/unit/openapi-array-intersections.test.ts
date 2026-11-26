import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { before, describe, test } from 'node:test'
import type express from 'express'
import { generate } from '../../src'
import { validateAndParse } from '../../src/runtime/validator'
import { options } from '../../src/option'
import { canonical } from '../compat/policy'
import { assertClientCompiles } from './intermediate-helpers'
import expected from '../fixtures/alpha71-openapi/array-intersections.json'
import runtime from '../fixtures/alpha71-openapi/array-runtime.json'

describe('Alpha.71 array intersections', () => {
  let spec: any
  before(async () => {
    const filePath = path.resolve(
      __dirname,
      'generated-openapi-array-intersections.json'
    )
    await generate({
      tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
      controllers: [
        path.resolve(__dirname, '../fixtures/validation/array-intersections.ts')
      ],
      openapi: { filePath, service: { name: 'generic', version: '1' } },
      router: {
        filePath: path.resolve(
          __dirname,
          'generated-router-array-intersections.ts'
        )
      }
    })
    spec = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  })
  test('Preserves the complete alpha.71 document', () =>
    assert.deepEqual(spec, expected))
  for (const [name, schema] of Object.entries(expected.components.schemas)) {
    test(`Preserves the alpha.71 schema for ${name}`, () =>
      assert.deepEqual(spec.components.schemas[name], schema))
  }
  for (const [group, cases] of Object.entries(runtime)) {
    const name = group.replace(/^exhaustive-/, '')
    test(`Matches alpha.71 parsed values and errors for ${group}`, async () => {
      options.features.enableThrowOnUnexpectedAdditionalData = true
      try {
        for (const sample of cases) {
          let result: unknown
          try {
            result = {
              value: await validateAndParse(
                {
                  body: sample.input,
                  headers: { 'content-type': 'application/json' }
                } as express.Request,
                spec.components.schemas,
                {
                  params: [{ name: 'body', in: 'body' as any }],
                  body: {
                    required: true,
                    content: {
                      'application/json': {
                        schema: spec.components.schemas.Cases.properties[name]
                      }
                    }
                  }
                }
              )
            }
          } catch (error) {
            const failure = error as {
              name: string
              message: string
              status: number
              fields: unknown
            }
            result = {
              error: {
                name: failure.name,
                message: failure.message,
                status: failure.status,
                fields: failure.fields
              }
            }
          }
          assert.deepEqual(
            canonical(result),
            sample.expected,
            `${name}: ${JSON.stringify(sample.input)}`
          )
        }
      } finally {
        options.features.enableThrowOnUnexpectedAdditionalData = false
      }
    })
  }
  test('Preserves alpha.71 scalar rejection and indexed arrays in queries', async () => {
    const params = spec.paths['/intersections/tags'].get.parameters
    const parse = (query: Record<string, unknown>) =>
      validateAndParse({ query } as express.Request, spec.components.schemas, {
        params
      })
    await assert.rejects(parse({ tags: 'a' }))
    assert.deepEqual(await parse({ tags: ['a', 'a'] }), [{ 0: 'a', 1: 'a' }])
    await assert.rejects(parse({ tags: 'b' }))
    await assert.rejects(parse({}))
  })
  test('Compiles enum includes calls and rejects the lossy array-union control', async () => {
    const directory = fs.mkdtempSync(
      path.join(__dirname, 'generated-array-client-')
    )
    try {
      const filePath = path.join(directory, 'schema.json')
      await generate({
        tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
        controllers: [
          path.resolve(
            __dirname,
            '../fixtures/validation/array-intersection-client.ts'
          )
        ],
        openapi: { filePath, service: { name: 'generic', version: '1' } },
        router: { filePath: path.join(directory, 'router.ts') }
      })
      const document = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      const usage =
        "import { ClientValue, Kind, WithoutWriteonly } from './definitions'\n" +
        'declare const value: ClientValue["tags"]\ndeclare const parsed: WithoutWriteonly<ClientValue>["tags"]\nvalue.includes(Kind.A)\nparsed.includes(Kind.A)\n'
      await assertClientCompiles(document, usage)
      const lossy = structuredClone(document)
      lossy.components.schemas.ClientValue.properties.tags = {
        readOnly: true,
        oneOf: ['a', 'b'].map(value => ({
          type: 'array',
          items: { type: 'string', enum: [value] }
        }))
      }
      await assert.rejects(
        assertClientCompiles(lossy, usage),
        (error: unknown) =>
          error instanceof Error &&
          'stdout' in error &&
          String(error.stdout).includes("parameter of type 'never'")
      )
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})
