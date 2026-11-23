import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import express from 'express'
import { validateAndParse } from '../../src/runtime/validator'

const request = {
  body: { value: 1 },
  headers: { 'content-type': 'application/json' }
} as express.Request
const object = { type: 'object', properties: { value: { type: 'string' } } }
const rules = {
  params: [{ name: 'body', in: 'body' }],
  body: { content: { 'application/json': { schema: object } } }
} as any

test('Should retain new validation errors if diagnostic validation succeeds', async () => {
  await assert.rejects(
    validateAndParse(request, {}, rules, {
      schemas: {},
      rules: {
        ...rules,
        body: { content: { 'application/json': { schema: {} } } }
      }
    }),
    {
      name: 'ValidateError',
      fields: {
        'body.value': {
          message: 'This property must be a string',
          details: [],
          value: 1
        }
      }
    }
  )
})

test('Should retain validation errors if a diagnostic schema is unavailable', async () => {
  await assert.rejects(
    validateAndParse(request, {}, rules, {
      schemas: {},
      rules: {
        ...rules,
        body: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Missing' }
            }
          }
        }
      }
    }),
    { name: 'ValidateError', message: 'This property must be a string' }
  )
})

test('Should evaluate the discriminator only once when formatting errors', async () => {
  let calls = 0
  const discriminated = {
    ...rules,
    bodyDiscriminatorFn: () => {
      calls++
      return 'Item'
    }
  }
  await assert.rejects(
    validateAndParse(request, { Item: object } as any, discriminated, {
      schemas: { Item: { allOf: [object] } } as any,
      rules: discriminated
    }),
    {
      name: 'ValidateError',
      fields: {
        'body.0.value': {
          message: 'This property must be a string',
          details: []
        }
      }
    }
  )
  assert.equal(calls, 1)
})

test('Should not run diagnostic validation on successful requests', async () => {
  let calls = 0
  const args = await validateAndParse(
    { ...request, body: { value: 'a' } } as express.Request,
    {},
    rules,
    {
      schemas: {},
      get rules() {
        calls++
        return rules
      }
    }
  )
  assert.deepEqual(args, [{ value: 'a' }])
  assert.equal(calls, 0)
})
