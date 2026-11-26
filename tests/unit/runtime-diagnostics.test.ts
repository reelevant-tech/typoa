import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import express from 'express'
import { ValidateError, validateAndParse } from '../../src/runtime/validator'

const request = {
  body: { value: 1 },
  headers: { 'content-type': 'application/json' }
} as express.Request
const object = { type: 'object', properties: { value: { type: 'string' } } }
const rules = {
  params: [{ name: 'body', in: 'body' }],
  body: { content: { 'application/json': { schema: object } } }
} as any

test('Should accept requests allowed by compositional validation', async () => {
  assert.deepEqual(
    await validateAndParse(request, {}, rules, {
      schemas: {},
      rules: {
        ...rules,
        body: { content: { 'application/json': { schema: {} } } }
      }
    }),
    [{ value: 1 }]
  )
})

test('Should not mask unavailable compositional schemas with flat validation', async () => {
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
    /Missing/
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

test('Should use compositional rules on successful requests', async () => {
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
  assert.equal(calls, 1)
})

for (const asynchronous of [false, true]) {
  test(`Should evaluate a ${asynchronous ? 'rejecting' : 'throwing'} discriminator only once`, async () => {
    let calls = 0
    const failure = new ValidateError({}, 'Discriminator failed')
    const discriminated = {
      ...rules,
      bodyDiscriminatorFn: () => {
        calls++
        if (asynchronous) return Promise.reject(failure)
        throw failure
      }
    }
    await assert.rejects(
      validateAndParse(request, {}, discriminated, {
        schemas: {},
        rules: discriminated
      }),
      error => error === failure
    )
    assert.equal(calls, 1)
  })
}
