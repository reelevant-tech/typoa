import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import express from 'express'
import request from 'supertest'
import Ajv from 'ajv'
import { generate } from '../../src'
import { createErrorHandler } from '../integration/shared'

test('Allocates distinct deterministic identities across generated collision orders over HTTP', async () => {
  const fixture = path.resolve(__dirname, 'generated-schema-name-matrix.ts')
  const tsconfig = path.resolve(
    __dirname,
    'generated-schema-name-matrix-config.json'
  )
  const prelude = `import { Body, BodyDiscriminatorFunction, Controller, Post, Route } from '../../src'
namespace First { export interface AnyValue_2 { first: string } }
namespace Second { export interface AnyValue_2 { second: number } }
namespace Operation { export interface Entry { label: string } }
interface AnyValue_3 { value: boolean }
interface Value_Recursive { text: string }
interface Wildcards { unknown: unknown; any: any }
type Nested = Nested[] | null
interface Holder { root: Nested }
interface Payload { label: string }
export type Payload_Nullable = Payload | null
interface NullableBase { value: Payload_Nullable }
interface NullableChild extends NullableBase { extra: string }
export const chooseAllocatedTarget: BodyDiscriminatorFunction = async () => 'AnyValue_3'
export const chooseAnyTarget: BodyDiscriminatorFunction = async () => 'AnyValue'
export const chooseNullableBase: BodyDiscriminatorFunction = async () => 'NullableBase'
`
  const methods = [
    `@Post('/first') first(@Body() body: First.AnyValue_2): First.AnyValue_2 { return body }`,
    `@Post('/second') second(@Body() body: Second.AnyValue_2): Second.AnyValue_2 { return body }`,
    `@Post('/export') exported(@Body() body: Operation.Entry): Operation.Entry { return body }`,
    `@Post('/wildcard') wildcard(@Body() body: Wildcards): Wildcards { return body }`,
    `@Post('/helper') helper(@Body() body: Value_Recursive): Value_Recursive { return body }`,
    `@Post('/target') target(@Body() body: AnyValue_3): AnyValue_3 { return body }`,
    `@Post('/selected') selected(@Body('application/json', chooseAllocatedTarget) body: AnyValue_3): AnyValue_3 { return body }`,
    `@Post('/recursive') recursive(@Body() body: Holder): Holder { return body }`,
    `@Post('/wildcard-selected') wildcardSelected(@Body('application/json', chooseAnyTarget) body: unknown): unknown { return body }`,
    `@Post('/nullable') nullable(@Body() body: NullableChild): NullableChild { return body }`,
    `@Post('/retained') retained(@Body('application/json', chooseNullableBase) body: unknown): unknown { return body }`
  ]
  const routes = [
    'first',
    'second',
    'export',
    'wildcard',
    'helper',
    'target',
    'selected',
    'recursive',
    'wildcard-selected',
    'nullable',
    'retained'
  ]
  const valid = [
    { first: 'Item' },
    { second: 1 },
    { label: 'Item' },
    {},
    { text: 'Item' },
    { value: true },
    { value: true },
    { root: [null, []] },
    {},
    { value: null, extra: 'Item' },
    { value: null }
  ]
  const invalid = [
    { first: 1 },
    { second: 'invalid' },
    { label: 1 },
    [],
    { text: 1 },
    { value: 'invalid' },
    { value: 'invalid' },
    { root: [1] },
    {},
    { value: 3, extra: 'Item' },
    { value: 3 }
  ]
  const expected = new Map<boolean, Record<string, string>>()
  try {
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        extends: path.resolve(__dirname, '../fixtures/tsconfig.json'),
        files: [
          fixture,
          path.resolve(__dirname, '../fixtures/validation/recursive-order.ts'),
          path.resolve(
            __dirname,
            '../fixtures/validation/additional-collisions.ts'
          )
        ],
        include: []
      })
    )
    for (const keepIntermediateSchemas of [true, false]) {
      for (let order = 0; order < 8; order++) {
        const numericExport = order >= 4
        const exports = ['Entry', 'Payload_Nullable']
        if (numericExport) exports.push('AnyValue')
        if (order % 2) exports.reverse()
        const arranged = [...methods.slice(order), ...methods.slice(0, order)]
        if (order % 2) arranged.reverse()
        fs.writeFileSync(
          fixture,
          `${prelude}\n@Route('/names')\nexport class AllocatedController extends Controller {\n${arranged.join('\n')}\n}`
        )
        const filePath = path.resolve(
          __dirname,
          `generated-schema-name-matrix-${keepIntermediateSchemas}-${order}.json`
        )
        await generate({
          tsconfigFilePath: tsconfig,
          controllers: [fixture],
          openapi: {
            filePath,
            keepIntermediateSchemas,
            additionalExportedTypeNames: exports,
            service: { name: 'generic', version: '1' }
          },
          router: {
            filePath: filePath.replace('.json', '.ts'),
            runtimeImport: '../../src'
          }
        })
        const spec = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        const references = Object.fromEntries(
          routes.map(route => [
            route,
            spec.paths[`/names/${route}`].post.requestBody.content[
              'application/json'
            ].schema.$ref
          ])
        )
        const distinct = routes.filter(
          route =>
            !['selected', 'wildcard-selected', 'retained'].includes(route)
        )
        assert.equal(
          new Set(distinct.map(route => references[route])).size,
          distinct.length
        )
        assert.equal(references.selected, references.target)
        assert.equal(references.target, '#/components/schemas/AnyValue_3')
        assert.equal(references.helper, '#/components/schemas/Value_Recursive')
        assert.deepEqual(
          spec.components.schemas.Entry,
          numericExport
            ? {
                $ref: '#/components/schemas/AnyValue'
              }
            : { type: 'number' }
        )
        if (numericExport)
          assert.deepEqual(spec.components.schemas.AnyValue, { type: 'number' })
        const wildcards =
          spec.components.schemas[references.wildcard.split('/').pop()!]
            .properties
        assert.notEqual(wildcards.unknown.$ref, wildcards.any.$ref)
        assert.equal(references['wildcard-selected'], wildcards.unknown.$ref)
        assert.equal(references.retained, wildcards.unknown.$ref)
        const nullable =
          spec.components.schemas[references.recursive.split('/').pop()!]
            .properties.root.$ref
        assert.ok(!Object.values(references).includes(nullable))
        assert.equal(
          spec.components.schemas[nullable.split('/').pop()!].type,
          'array'
        )
        assert.equal(
          spec.components.schemas[nullable.split('/').pop()!].nullable,
          true
        )
        const identities = {
          ...references,
          unknown: wildcards.unknown.$ref,
          any: wildcards.any.$ref,
          nullable
        }
        if (expected.has(numericExport))
          assert.deepEqual(identities, expected.get(numericExport))
        else expected.set(numericExport, identities)
        for (const property of Object.values(wildcards) as { $ref: string }[]) {
          assert.ok(
            !distinct.map(route => references[route]).includes(property.$ref)
          )
          assert.deepEqual(
            spec.components.schemas[property.$ref.split('/').pop()!],
            { description: 'Can be any value', nullable: true }
          )
        }
        const { AllocatedController } = await import(fixture)
        let calls = 0
        let received: unknown
        const originals = routes.map(route => {
          const method =
            route === 'export'
              ? 'exported'
              : route.replace(/-([a-z])/g, (_, letter: string) =>
                  letter.toUpperCase()
                )
          const original = AllocatedController.prototype[method]
          AllocatedController.prototype[method] = function (body: unknown) {
            calls++
            received = body
            return original.call(this, body)
          }
          return [method, original] as const
        })
        try {
          const app = express()
          app.use(express.json({ strict: false }))
          const { bindToRouter } = await import(
            filePath.replace('.json', '.ts')
          )
          bindToRouter(app)
          app.use(createErrorHandler())
          for (let i = 0; i < routes.length; i++) {
            const before = calls
            const selectedWildcard = routes[i] === 'wildcard-selected'
            const sent = selectedWildcard
              ? numericExport
                ? 2
                : { nested: [null, 'Item'] }
              : valid[i]
            const accepted = await request(app)
              .post(`/names/${routes[i]}`)
              .type('json')
              .send(JSON.stringify(sent))
              .expect(200)
            assert.deepEqual(accepted.body, sent)
            assert.deepEqual(received, sent)
            assert.equal(calls, before + 1)
            if (selectedWildcard && !numericExport) {
              await request(app)
                .post(`/names/${routes[i]}`)
                .type('text')
                .send('invalid')
                .expect(400)
            } else {
              await request(app)
                .post(`/names/${routes[i]}`)
                .send(invalid[i])
                .expect(400)
            }
            assert.equal(calls, before + 1)
            if (i !== 3 && !(selectedWildcard && !numericExport)) {
              await request(app)
                .post(`/names/${routes[i]}`)
                .send({})
                .expect(400)
              assert.equal(calls, before + 1)
            }
            if (i < 2) {
              await request(app)
                .post(`/names/${routes[i]}`)
                .send(valid[1 - i])
                .expect(400)
              assert.equal(calls, before + 1)
            }
          }
          for (const body of [null, { label: 'Item' }]) {
            for (const [route, input] of [
              ['nullable', { value: body, extra: 'Item' }],
              ['retained', { value: body }]
            ] as const) {
              const before = calls
              await request(app).post(`/names/${route}`).send(input).expect(200)
              assert.deepEqual(received, input)
              assert.equal(calls, before + 1)
            }
          }
          if (!numericExport) {
            for (const body of [null, [], 'Item', {}]) {
              const before = calls
              await request(app)
                .post('/names/wildcard-selected')
                .type('json')
                .send(JSON.stringify(body))
                .expect(body === null ? 204 : 200)
              assert.deepEqual(received, body)
              assert.equal(calls, before + 1)
            }
          }
          const ajv = new Ajv({ strict: false })
          ajv.addSchema({ components: spec.components }, 'spec')
          const validateExport = ajv.compile({
            $ref: 'spec#/components/schemas/Payload_Nullable'
          })
          assert.equal(validateExport(null), true)
          assert.equal(validateExport({ label: 'Item' }), true)
          assert.equal(validateExport({ label: 1 }), false)
          if (keepIntermediateSchemas) {
            const validateBase = ajv.compile({
              $ref: 'spec#/components/schemas/NullableBase'
            })
            assert.equal(validateBase({ value: null }), true)
            assert.equal(validateBase({ value: { label: 'Item' } }), true)
            assert.equal(validateBase({ value: {} }), false)
          }
        } finally {
          for (const [method, original] of originals)
            AllocatedController.prototype[method] = original
        }
      }
    }
  } finally {
    fs.rmSync(fixture, { force: true })
    fs.rmSync(tsconfig, { force: true })
  }
})
