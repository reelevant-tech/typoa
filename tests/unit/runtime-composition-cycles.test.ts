import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import express from 'express'
import { OpenAPIV3 } from 'openapi-types'
import { validateAndParse } from '../../src/runtime/validator'

const ref = { $ref: '#/components/schemas/Item' }
const request = (body: unknown) =>
  ({
    body,
    headers: { 'content-type': 'application/json' },
    readableEnded: true
  }) as express.Request
const rules = (schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) => ({
  params: [{ name: 'body', in: 'body' }],
  body: { content: { 'application/json': { schema } } }
})

for (const [name, edge] of Object.entries({
  properties: { type: 'object', properties: { next: ref } },
  items: { type: 'array', items: ref },
  allOf: { allOf: [ref] },
  anyOf: { anyOf: [ref] },
  oneOf: { oneOf: [ref] },
  not: { not: ref },
  additionalProperties: { type: 'object', additionalProperties: ref }
} as Record<string, OpenAPIV3.SchemaObject>)) {
  test(`Recursive ${name} uses flattened acceptance rather than a permissive composition`, async () => {
    const flat = rules({
      type: 'object',
      properties: { value: { type: 'number', enum: [1] } }
    })
    const schemas = {
      Item: { type: 'object', properties: { value: { type: 'number' }, edge } }
    } as const
    await assert.rejects(
      validateAndParse(request({ value: 2 }), {}, flat, {
        schemas,
        rules: rules(ref)
      }),
      {
        name: 'ValidateError',
        fields: {
          'body.value': {
            message: 'This property must be one of 1',
            details: [],
            value: 2
          }
        }
      }
    )
  })
}

test('Repeated acyclic references and example refs keep compositional values', async () => {
  const schemas = {
    Item: { type: 'number' as const, example: ref }
  }
  const schema: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties: { left: ref, right: ref }
  }
  assert.deepEqual(
    await validateAndParse(
      request({ left: 1, right: 2 }),
      {},
      rules({ type: 'object' }),
      {
        schemas,
        rules: rules(schema)
      }
    ),
    [{ left: 1, right: 2 }]
  )
})

test('Recursion cache is scoped to the schema document', async () => {
  const flat = rules({
    type: 'object',
    properties: { name: { type: 'string' } }
  })
  const validate = (next: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject) =>
    validateAndParse(request({ name: 'Item', next: {} }), {}, flat, {
      schemas: {
        Item: { type: 'object', properties: { name: { type: 'string' }, next } }
      },
      rules: rules(ref)
    })
  assert.deepEqual(await validate(ref), [{ name: 'Item' }])
  assert.deepEqual(await validate({}), [{ name: 'Item', next: {} }])
})
