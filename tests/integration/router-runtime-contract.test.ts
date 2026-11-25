import { strict as assert } from 'node:assert'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { before, after, test } from 'node:test'
import express from 'express'
import expressPackage from 'express/package.json'
import { generate } from '../../src'
import baseline from '../fixtures/validation/runtime-contract.json'

const requests: {
  name: string
  method: string
  endpoint: string
  headers: http.OutgoingHttpHeaders
  body?: string
}[] = []
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
  const variants: [string, http.OutgoingHttpHeaders, string?][] = [
    ['absent', {}],
    [
      'json-empty',
      { 'content-type': 'application/json', 'content-length': '0' }
    ],
    ['json-object', { 'content-type': 'application/json' }, '{}'],
    [
      'json-chunked-empty',
      { 'content-type': 'application/json', 'transfer-encoding': 'chunked' }
    ],
    ['text-empty', { 'content-type': 'text/plain', 'content-length': '0' }],
    ['text-body', { 'content-type': 'text/plain' }, 'hello'],
    ['missing-type-body', {}, 'hello']
  ]
  for (const [name, headers, body] of variants) {
    requests.push({
      name: `${method} ${name}`,
      method,
      endpoint: 'optional',
      headers,
      body
    })
  }
}
for (const [name, endpoint, body, headers] of [
  [
    'required-property-empty',
    'object',
    undefined,
    { 'content-type': 'application/json', 'content-length': '0' }
  ],
  [
    'form-empty',
    'form',
    undefined,
    {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': '0'
    }
  ],
  [
    'form-value',
    'form',
    'tag=a',
    { 'content-type': 'application/x-www-form-urlencoded' }
  ],
  [
    'intersection-invalid',
    'intersection',
    JSON.stringify({ id: 'a', query: {} }),
    { 'content-type': 'application/json' }
  ],
  [
    'nested-invalid',
    'nested',
    JSON.stringify({ item: { id: 'a', query: {} } }),
    { 'content-type': 'application/json' }
  ],
  [
    'array-invalid',
    'array',
    JSON.stringify([{ id: 'a', query: {} }]),
    { 'content-type': 'application/json' }
  ],
  [
    'union-invalid',
    'union',
    JSON.stringify({ id: 'a', query: {} }),
    { 'content-type': 'application/json' }
  ]
] as [string, string, string | undefined, http.OutgoingHttpHeaders][]) {
  requests.push({ name, endpoint, body, headers, method: 'POST' })
}
requests.push({
  name: 'query-invalid',
  method: 'GET',
  endpoint: 'query?filter=a&filter=b',
  headers: {}
})

let server: http.Server
before(async () => {
  const routerFile = path.resolve(__dirname, 'generated-runtime-contract.ts')
  const openapiFile = path.resolve(__dirname, 'generated-runtime-contract.json')
  await generate({
    tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
    controllers: [
      path.resolve(
        __dirname,
        '../fixtures/controllers/controller-runtime-contract.ts'
      )
    ],
    openapi: {
      filePath: openapiFile,
      service: { name: 'contract', version: '1' }
    },
    router: { filePath: routerFile, runtimeImport: '../../src' }
  })
  const spec = JSON.parse(fs.readFileSync(openapiFile, 'utf8'))
  assert.deepEqual(
    spec.paths['/contract/intersection'].post.requestBody.content[
      'application/json'
    ].schema,
    {
      allOf: [
        { $ref: '#/components/schemas/Item' },
        {
          type: 'object',
          properties: {},
          additionalProperties: { $ref: '#/components/schemas/AnyValue' }
        }
      ]
    }
  )
  const app = express()
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    res.set('x-parsed-body', JSON.stringify(req.body) ?? 'undefined')
    res.set('x-input-length', req.headers['content-length'] ?? 'absent')
    next()
  })
  const { bindToRouter } = await import(routerFile)
  bindToRouter(app)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const errors: express.ErrorRequestHandler = (error, _req, res, _next) => {
    res
      .status(error.status || 400)
      .json({ fields: error.fields, message: error.message })
  }
  app.use(errors)
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
})
after(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    )
})

const expected = baseline[expressPackage.version[0] as keyof typeof baseline]
for (const input of requests) {
  if (
    input.body !== undefined &&
    input.headers['content-length'] === undefined &&
    input.headers['transfer-encoding'] === undefined
  ) {
    input.headers['content-length'] = String(Buffer.byteLength(input.body))
  }
  test(`Should match alpha.71 for ${input.name}`, async () => {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: address.port,
          path: `/contract/${input.endpoint}`,
          method: input.method,
          headers: input.headers
        },
        res => {
          let text = ''
          res.on('data', chunk => {
            text += chunk
          })
          res.on('end', () => {
            let body = text
            try {
              body = JSON.parse(text)
            } catch {}
            resolve(
              JSON.parse(
                JSON.stringify({
                  name: input.name,
                  status: res.statusCode,
                  body: input.method === 'HEAD' ? null : body,
                  controller: res.headers['x-controller-body'],
                  parsed: res.headers['x-parsed-body'],
                  length: res.headers['x-input-length']
                })
              )
            )
          })
        }
      )
      req.on('error', reject)
      req.end(input.body)
    })
    assert.ok(
      typeof result === 'object' && result !== null && 'parsed' in result
    )
    assert.deepEqual(
      result,
      expected.find(item => item.name === input.name)
    )
  })
}
