import path from 'path'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { execFileSync } from 'child_process'
import { strict as assert } from 'node:assert'
import { before, describe, test } from 'node:test'
import Ajv from 'ajv'
import type express from 'express'
import { OpenAPIV3 } from 'openapi-types'
import { generate as generateClient } from 'oatyp'
import { generate } from '../../src'
import { validateAndParse } from '../../src/runtime/validator'
import { options } from '../../src/option'

describe('Lossless intersections', () => {
  let spec: OpenAPIV3.Document
  let properties: Record<string, any>
  const ajv = new Ajv({ strict: false })
  const literal = { type: 'string', enum: ['a'] }
  const kind = { $ref: '#/components/schemas/Kind' }
  const tags = {
    allOf: [
      { type: 'array', items: literal },
      { type: 'array', items: kind }
    ]
  }
  const direct = tags
  const nullableTags = {
    allOf: tags.allOf.map(member => ({ ...member, nullable: true }))
  }
  const object = (
    properties: Record<string, unknown>,
    required = Object.keys(properties),
    additionalProperties: unknown = false
  ) => ({
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties
  })
  const named = object({
    name: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } }
  })

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
      openapi: { filePath, service: { name: 'test', version: '1' } },
      router: {
        filePath: path.resolve(
          __dirname,
          'generated-router-array-intersections.ts'
        )
      }
    })
    spec = JSON.parse(readFileSync(filePath, 'utf8'))
    properties = (spec.components!.schemas!.Cases as OpenAPIV3.SchemaObject)
      .properties!
    ajv.addSchema({ components: spec.components }, 'spec')
  })

  test('Should compile enum includes calls in a generated client', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'array-client-'))
    const compile = () =>
      execFileSync(
        process.execPath,
        [
          require.resolve('typescript/bin/tsc'),
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'es2022',
          '--moduleResolution',
          'node',
          path.join(directory, 'snippet.ts')
        ],
        { encoding: 'utf8' }
      )
    const writeClient = async (document: OpenAPIV3.Document) => {
      const openapiFilePath = path.join(directory, 'schema.json')
      writeFileSync(openapiFilePath, JSON.stringify(document))
      await generateClient({ outDir: directory, openapiFilePath })
    }
    try {
      const filePath = path.join(directory, 'openapi.json')
      await generate({
        tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
        controllers: [
          path.resolve(
            __dirname,
            '../fixtures/validation/array-intersection-client.ts'
          )
        ],
        openapi: { filePath, service: { name: 'test', version: '1' } },
        router: { filePath: path.join(directory, 'router.ts') }
      })
      const clientSpec = JSON.parse(
        readFileSync(filePath, 'utf8')
      ) as OpenAPIV3.Document
      await writeClient(clientSpec)
      writeFileSync(
        path.join(directory, 'snippet.ts'),
        "import { ClientValue, Kind, WithoutWriteonly } from './definitions'\n" +
          'declare const value: ClientValue["tags"]\n' +
          'declare const parsed: WithoutWriteonly<ClientValue>["tags"]\n' +
          'value.includes(Kind.A)\nparsed.includes(Kind.A)\n'
      )
      compile()

      const lossy = structuredClone(clientSpec)
      const cases = lossy.components!.schemas!
        .ClientValue as OpenAPIV3.SchemaObject
      cases.properties!.tags = {
        readOnly: true,
        oneOf: ['a', 'b'].map(value => ({
          type: 'array',
          items: { type: 'string', enum: [value] }
        }))
      }
      await writeClient(lossy)
      assert.throws(
        compile,
        (error: unknown) =>
          error instanceof Error &&
          'stdout' in error &&
          String(error.stdout).includes("parameter of type 'never'")
      )
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  const expected: Record<string, unknown> = {
    direct,
    tags,
    nullableTags,
    boundedTags: { ...tags, minItems: 1, maxItems: 2 },
    inheritedNullableBounds: { $ref: '#/components/schemas/NullableListPair' },
    enumChoice: {
      oneOf: [
        tags,
        {
          allOf: [
            { type: 'array', items: { type: 'string', enum: ['b'] } },
            { type: 'array', items: kind }
          ]
        }
      ]
    },
    mixed: {
      allOf: [
        { type: 'array', items: kind },
        { type: 'array', items: { type: 'string' } }
      ]
    },
    primitives: {
      allOf: [
        { type: 'array', items: { type: 'string' } },
        { type: 'array', items: { type: 'number' } }
      ]
    },
    three: {
      allOf: [...tags.allOf, { type: 'array', items: { type: 'string' } }]
    },
    objectPrimitive: {
      allOf: [
        { type: 'array', items: { $ref: '#/components/schemas/Named' } },
        { type: 'array', items: { type: 'string' } }
      ]
    },
    nestedMixed: {
      allOf: [
        { type: 'array', items: { type: 'array', items: kind } },
        { type: 'array', items: { type: 'array', items: { type: 'string' } } }
      ]
    },
    serialized: object({ tags }),
    choice: {
      oneOf: [object({ tags }), object({ other: { type: 'boolean' } })]
    },
    objects: { type: 'array', items: named },
    defaultObjects: {
      type: 'array',
      items: object({ count: { type: 'number', default: 1 } }, [])
    },
    reversedDefaultObjects: {
      type: 'array',
      items: object({ count: { type: 'number', default: 1 } }, [])
    },
    requiredDefaultObjects: {
      type: 'array',
      items: object({ count: { type: 'number', default: 1 } })
    },
    reversedRequiredDefaultObjects: {
      type: 'array',
      items: object({ count: { type: 'number', default: 1 } })
    },
    objectsWithIntersection: { type: 'array', items: named },
    nullableObjectsWithIntersection: {
      type: 'array',
      items: { ...named, nullable: true }
    },
    nestedObjectsWithIntersection: {
      type: 'array',
      items: { type: 'array', items: named }
    },
    nullableObjects: { type: 'array', items: { ...named, nullable: true } },
    mixedNullableObjects: { type: 'array', items: named },
    nestedNullableObjects: {
      type: 'array',
      items: { type: 'array', items: { ...named, nullable: true } }
    },
    nested: {
      allOf: tags.allOf.map(member => ({ type: 'array', items: member }))
    },
    nestedDirect: {
      allOf: direct.allOf.map(member => ({ type: 'array', items: member }))
    },
    nestedObjects: { type: 'array', items: { type: 'array', items: named } },
    enumValue: { type: 'string', enum: ['b'] },
    conflict: object({
      value: { allOf: [{ type: 'string' }, { type: 'number' }] }
    }),
    optionalConflict: object({}, []),
    required: object({ value: { type: 'string' } }),
    constraints: object({
      name: { type: 'string', minLength: 2, maxLength: 4 }
    }),
    inherited: { $ref: '#/components/schemas/Inherited' },
    narrowed: { $ref: '#/components/schemas/Narrowed' },
    bounded: object({
      tags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 2
      }
    }),
    indexed: object({}, [], {
      allOf: [{ type: 'string' }, { type: 'number' }]
    }),
    inheritedIndex: { $ref: '#/components/schemas/Indexed' },
    openIndex: object({ name: { type: 'string' } }, ['name'], {
      $ref: '#/components/schemas/AnyValue'
    }),
    anyIndex: object({ name: { type: 'string' } }, ['name'], {
      $ref: '#/components/schemas/AnyValue'
    }),
    indexedProperty: object(
      { count: { allOf: [{ type: 'number' }, { type: 'string' }] } },
      ['count'],
      { type: 'string' }
    ),
    numericIndex: object({ name: { type: 'number' } }, ['name'], {
      type: 'string'
    }),
    numericProperty: object(
      { 0: { allOf: [{ type: 'number' }, { type: 'string' }] } },
      ['0'],
      { type: 'string' }
    ),
    nonNumericProperty: object(
      { '01': { type: 'number' }, '1e2': { type: 'number' } },
      ['01', '1e2'],
      { type: 'string' }
    ),
    closed: object({ name: { type: 'string' } }),
    inheritedClosed: { $ref: '#/components/schemas/ClosedPair' },
    modifiers: object({ name: { type: 'string', readOnly: true } }),
    readMerge: object({ value: { type: 'string', readOnly: true } }),
    writeMerge: { $ref: '#/components/schemas/WritePair' },
    mutableClass: { $ref: '#/components/schemas/MutableItem' },
    mutableOverride: { $ref: '#/components/schemas/MutablePair' },
    branded: {
      allOf: [{ type: 'string' }, object({ tag: { type: 'string' } })]
    },
    reference: {
      allOf: [
        { $ref: '#/components/schemas/JsonValue' },
        object({ tag: { type: 'string' } })
      ]
    },
    referenceProperty: object({
      data: { $ref: '#/components/schemas/Named' },
      note: { type: 'string' }
    }),
    composedReference: {
      allOf: [
        { $ref: '#/components/schemas/JsonChoice' },
        object({ active: { type: 'boolean' } })
      ]
    },
    union: {
      oneOf: [
        object({ name: { type: 'string' }, active: { type: 'boolean' } }),
        object({ count: { type: 'number' }, active: { type: 'boolean' } })
      ]
    }
  }

  for (const [name, schema] of Object.entries(expected)) {
    test(`Should preserve the exact schema for ${name}`, () => {
      assert.deepEqual(properties[name], schema)
    })
  }

  test('Should retain enum references and composed references', () => {
    assert.deepEqual(
      spec.components!.schemas!.Indexed,
      object({ kind: literal }, ['kind'], { type: 'string' })
    )
    assert.deepEqual(spec.components!.schemas!.ClosedPair, expected.closed)
    assert.deepEqual(
      spec.components!.schemas!.Narrowed,
      object({ name: { type: 'string', minLength: 3 } })
    )
    assert.deepEqual(
      spec.components!.schemas!.Inherited,
      object({
        name: {
          allOf: [
            { type: 'string', minLength: 2 },
            { type: 'string', maxLength: 4 }
          ]
        }
      })
    )
    assert.deepEqual(spec.components!.schemas!.Kind, {
      type: 'string',
      enum: ['a', 'b']
    })
    assert.deepEqual(spec.components!.schemas!.JsonValue, { type: 'string' })
    assert.deepEqual(spec.components!.schemas!.JsonChoice, {
      oneOf: [
        object({ left: { type: 'string' } }),
        object({ right: { type: 'number' } })
      ]
    })
  })

  test('Should merge writeOnly metadata from a non-leading base', () => {
    assert.deepEqual(
      spec.components!.schemas!.WritePair,
      object({ value: { type: 'string', writeOnly: true } })
    )
  })

  test('Should not copy metadata from an overridden class property', () => {
    assert.deepEqual(
      spec.components!.schemas!.MutableItem,
      object({ value: { type: 'string', default: 'x' } }, [])
    )
  })

  test('Should let an interface override inherited readonly metadata', () => {
    assert.deepEqual(
      spec.components!.schemas!.MutablePair,
      object({
        value: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      })
    )
  })

  const parse = (schema: OpenAPIV3.SchemaObject, value: unknown) =>
    validateAndParse(
      {
        body: value,
        headers: { 'content-type': 'application/json' }
      } as express.Request,
      spec.components!.schemas!,
      {
        params: [{ name: 'body', in: 'body' as any }],
        body: { required: true, content: { 'application/json': { schema } } }
      }
    )

  test('Should wrap a single query value for intersected arrays', async () => {
    const operation = spec.paths['/intersections/tags']!.get!
    const params = operation.parameters as OpenAPIV3.ParameterObject[]
    assert.deepEqual(params[0].schema, tags)
    const parseQuery = (query: Record<string, unknown>) =>
      validateAndParse(
        { query } as express.Request,
        spec.components!.schemas!,
        { params }
      )
    assert.deepEqual(await parseQuery({ tags: 'a' }), [['a']])
    assert.deepEqual(await parseQuery({ tags: ['a', 'a'] }), [['a', 'a']])
    await assert.rejects(parseQuery({ tags: 'b' }))
    await assert.rejects(parseQuery({}))
  })

  test('Should preserve nullable arrays through inherited bound compositions', () => {
    assert.deepEqual(
      spec.components!.schemas!.NullableListPair,
      object({
        tags: {
          allOf: [
            { ...nullableTags, minItems: 1 },
            { ...nullableTags, maxItems: 2 }
          ]
        }
      })
    )
  })

  test('Should validate open index signatures without weakening named properties', async () => {
    for (const name of ['openIndex', 'anyIndex']) {
      for (const value of [
        { name: 'x', extra: 1 },
        { name: 'x', extra: { value: true } }
      ]) {
        assert.deepEqual(await parse(properties[name], value), [value])
      }
      for (const value of [{}, { name: {} }]) {
        await assert.rejects(() => parse(properties[name], value))
      }
    }
  })

  test('Should preserve array constraints for a small exhaustive set of values', async () => {
    const values: unknown[] = ['a', 'b', 'c', 3, null, {}]
    const arrays = [
      [],
      ...values.map(value => [value]),
      ...values.flatMap(a => values.map(b => [a, b]))
    ]
    for (const name of ['direct', 'tags', 'serialized', 'choice', 'nested']) {
      for (const array of arrays) {
        const value =
          name === 'serialized' || name === 'choice'
            ? { tags: array }
            : name === 'nested'
              ? [array]
              : array
        const valid = array.every(item => item === 'a')
        assert.equal(
          ajv.validate(
            { $ref: `spec#/components/schemas/Cases/properties/${name}` },
            value
          ),
          valid,
          `${name}: ${JSON.stringify(value)}`
        )
        if (valid)
          assert.deepEqual(await parse(properties[name], value), [value])
        else await assert.rejects(parse(properties[name], value))
      }
    }
  })

  const samples: Record<string, { valid: unknown[]; invalid: unknown[] }> = {
    nullableTags: { valid: [null, [], ['a']], invalid: [['b'], 1, {}] },
    inheritedNullableBounds: {
      valid: [{ tags: null }, { tags: ['a'] }, { tags: ['a', 'a'] }],
      invalid: [{}, { tags: [] }, { tags: ['a', 'a', 'a'] }, { tags: ['b'] }]
    },
    boundedTags: {
      valid: [['a'], ['a', 'a']],
      invalid: [[], ['a', 'a', 'a'], ['b']]
    },
    enumChoice: {
      valid: [['a'], ['b']],
      invalid: [['a', 'b'], ['c'], [null]]
    },
    mixed: { valid: [[], ['a', 'b']], invalid: [['c'], [1], [null]] },
    primitives: { valid: [[]], invalid: [['a'], [1], [null]] },
    three: { valid: [[], ['a']], invalid: [['b'], ['c'], [1]] },
    objectPrimitive: { valid: [[]], invalid: [[{ name: 'x' }], ['a']] },
    nestedMixed: { valid: [[], [[]], [['a', 'b']]], invalid: [[['c']], [[1]]] },
    nullableObjects: {
      valid: [
        [],
        [null],
        [{ name: 'x', tags: [] }],
        [null, { name: 'x', tags: ['a'] }]
      ],
      invalid: [
        [{}],
        [{ name: 'x' }],
        [{ name: 'x', tags: {} }],
        [{ name: 'x', tags: [], extra: true }]
      ]
    },
    mixedNullableObjects: {
      valid: [[], [{ name: 'x', tags: [] }]],
      invalid: [[null], [{}], [{ tags: [] }]]
    },
    nestedNullableObjects: {
      valid: [[], [[]], [[null, { name: 'x', tags: [] }]]],
      invalid: [[null], [[{}]], [[{ name: 'x' }]]]
    },
    mutableOverride: {
      valid: [
        { value: 'x', tags: [] },
        { value: 'y', tags: ['a'] }
      ],
      invalid: [{}, { value: {}, tags: [] }, { value: 'x', tags: {} }]
    },
    objects: {
      valid: [[], [{ name: 'x', tags: [] }]],
      invalid: [[{}], [{ name: 'x' }]]
    },
    defaultObjects: {
      valid: [[], [{ count: 2 }]],
      invalid: [[{ count: 'a' }]]
    },
    reversedDefaultObjects: {
      valid: [[], [{ count: 2 }]],
      invalid: [[{ count: 'a' }]]
    },
    requiredDefaultObjects: {
      valid: [[], [{ count: 2 }]],
      invalid: [[{}], [{ count: 'a' }]]
    },
    reversedRequiredDefaultObjects: {
      valid: [[], [{ count: 2 }]],
      invalid: [[{}], [{ count: 'a' }]]
    },
    objectsWithIntersection: {
      valid: [[], [{ name: 'x', tags: ['a'] }]],
      invalid: [[{ name: 'x' }], [{ tags: ['a'] }], [{ name: 'x', tags: [1] }]]
    },
    nullableObjectsWithIntersection: {
      valid: [[], [null], [{ name: 'x', tags: ['a'] }, null]],
      invalid: [[{ name: 'x' }], [{ tags: ['a'] }], [{ name: 'x', tags: [1] }]]
    },
    nestedObjectsWithIntersection: {
      valid: [[], [[]], [[{ name: 'x', tags: ['a'] }]]],
      invalid: [[[null]], [[{ name: 'x' }]], [[{ name: 'x', tags: [1] }]]]
    },
    nestedObjects: {
      valid: [[], [[{ name: 'x', tags: [] }]]],
      invalid: [[[{}]]]
    },
    enumValue: { valid: ['b'], invalid: ['a', 'c'] },
    conflict: { valid: [], invalid: [{}, { value: {} }] },
    optionalConflict: { valid: [{}], invalid: [{ value: {} }] },
    required: { valid: [{ value: 'x' }], invalid: [{}, { value: {} }] },
    inherited: {
      valid: [{ name: 'ab' }],
      invalid: [{ name: 'a' }, { name: 'abcde' }]
    },
    bounded: {
      valid: [{ tags: ['a'] }, { tags: ['a', 'b'] }],
      invalid: [{ tags: [] }, { tags: ['a', 'b', 'c'] }]
    },
    constraints: {
      valid: [{ name: 'ab' }, { name: 'abcd' }],
      invalid: [{ name: 'a' }, { name: 'abcde' }, {}]
    },
    indexed: { valid: [{}], invalid: [{ x: {} }] },
    inheritedIndex: {
      valid: [{ kind: 'a', other: 'b' }],
      invalid: [{ kind: 'b' }, { kind: 'a', other: {} }]
    },
    indexedProperty: { valid: [], invalid: [{}, { count: {} }] },
    numericIndex: {
      valid: [{ name: 1 }, { name: 1, 0: 'x' }],
      invalid: [{}, { name: {} }, { name: 1, 0: {} }]
    },
    numericProperty: { valid: [], invalid: [{}, { 0: {} }] },
    nonNumericProperty: {
      valid: [{ '01': 1, '1e2': 2 }],
      invalid: [{}, { '01': {}, '1e2': 2 }]
    },
    closed: {
      valid: [{ name: 'x' }],
      invalid: [{ name: 'x', extra: true }, {}]
    },
    inheritedClosed: {
      valid: [{ name: 'x' }],
      invalid: [{ name: 'x', extra: true }]
    },
    branded: { valid: [], invalid: ['x', {}] },
    reference: { valid: [], invalid: ['x', {}] },
    referenceProperty: {
      valid: [{ data: { name: 'x' }, note: 'n' }],
      invalid: [{ data: {}, note: 'n' }]
    },
    composedReference: { valid: [], invalid: [{ active: true }, {}] },
    union: {
      valid: [
        { name: 'x', active: true },
        { count: 1, active: false }
      ],
      invalid: [{ name: 'x' }, { active: true }]
    }
  }
  test('Should apply class defaults regardless of array member order', async () => {
    for (const name of ['defaultObjects', 'reversedDefaultObjects']) {
      assert.equal(
        ajv.validate(
          { $ref: `spec#/components/schemas/Cases/properties/${name}` },
          [{}]
        ),
        true
      )
      assert.deepEqual(await parse(properties[name], [{}]), [[{ count: 1 }]])
    }
  })

  test('Should document ambiguous empty array union validation', async () => {
    const value: unknown[] = []
    const validate = ajv.compile({
      $ref: 'spec#/components/schemas/Cases/properties/enumChoice'
    })
    assert.equal(validate(value), false)
    assert.deepEqual(await parse(properties.enumChoice, value), [[]])
  })

  for (const [name, { valid, invalid }] of Object.entries(samples)) {
    test(`Should validate retained constraints for ${name}`, async () => {
      options.features.enableThrowOnUnexpectedAdditionalData = true
      try {
        for (const value of valid) {
          assert.equal(
            ajv.validate(
              { $ref: `spec#/components/schemas/Cases/properties/${name}` },
              value
            ),
            true
          )
          assert.deepEqual(await parse(properties[name], value), [value])
        }
        for (const value of invalid) {
          assert.equal(
            ajv.validate(
              { $ref: `spec#/components/schemas/Cases/properties/${name}` },
              value
            ),
            false
          )
          await assert.rejects(parse(properties[name], value))
        }
      } finally {
        options.features.enableThrowOnUnexpectedAdditionalData = false
      }
    })
  }

  test('Should keep readonly, required and non-nullable constraints together', async () => {
    const schema = properties.modifiers.properties.name
    assert.deepEqual(await parse(schema, 'x'), ['x'])
    await assert.rejects(parse(schema, null))
    assert.equal(
      ajv.validate(
        { $ref: 'spec#/components/schemas/Cases/properties/modifiers' },
        {}
      ),
      false
    )
  })
})
