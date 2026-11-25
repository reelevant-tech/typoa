import fs from 'fs'
import path from 'path'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import express from 'express'
import { generate } from '../../src'
import { validateAndParse } from '../../src/runtime/validator'

test('Should generate diagnostics for a nonrecursive subtype of a recursive interface', async () => {
  const openapiFile = path.resolve(__dirname, 'generated-recursive-base.json')
  const routerFile = path.resolve(__dirname, 'generated-recursive-base.ts')
  await generate({
    tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
    controllers: [
      path.resolve(
        __dirname,
        '../fixtures/validation/runtime-recursive-base.ts'
      )
    ],
    openapi: {
      filePath: openapiFile,
      service: { name: 'contract', version: '1' }
    },
    router: { filePath: routerFile, runtimeImport: '../../src' }
  })
  const spec = JSON.parse(fs.readFileSync(openapiFile, 'utf8'))
  assert.deepEqual(spec.components.schemas.Item, {
    type: 'object',
    properties: { name: { type: 'string' } },
    required: ['name'],
    additionalProperties: false
  })
  const router = fs.readFileSync(routerFile, 'utf8')
  const schemas = JSON.parse(router.match(/const diagnosticSchemas = (.*)/)![1])
  assert.deepEqual(schemas.RecursiveItem.properties.next, {
    $ref: '#/components/schemas/RecursiveItem'
  })
  assert.deepEqual(schemas.Item.allOf[0], {
    $ref: '#/components/schemas/RecursiveItem'
  })
  const rules = {
    params: [{ name: 'body', in: 'body' }],
    body: spec.paths['/items'].post.requestBody
  }
  const validate = (body: unknown) =>
    validateAndParse(
      {
        body,
        headers: { 'content-type': 'application/json' },
        readableEnded: true
      } as express.Request,
      spec.components.schemas,
      rules,
      { schemas, rules }
    )
  assert.deepEqual(await validate({ name: 'a' }), [{ name: 'a' }])
  assert.deepEqual(await validate({ name: 'a', next: {} }), [{ name: 'a' }])
  for (const [body, message] of [
    [{}, 'Property name is required'],
    [{ name: 1 }, 'This property must be a string']
  ] as const) {
    await assert.rejects(validate(body), {
      name: 'ValidateError',
      fields: { 'body.1.name': { message, details: [] } }
    })
  }
})
