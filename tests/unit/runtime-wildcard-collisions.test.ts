import path from 'node:path'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import express from 'express'
import request from 'supertest'
import { generate } from '../../src'
import { RecursiveOrderController } from '../fixtures/validation/recursive-order'
import { createErrorHandler } from '../integration/shared'

test('Preserves omitted any and unknown properties with renamed wildcard schemas over HTTP', async t => {
  const controller = t.mock.method(
    RecursiveOrderController.prototype,
    'wildcard'
  )
  for (const keepIntermediateSchemas of [false, true]) {
    for (const renamed of [false, true]) {
      const filePath = path.resolve(
        __dirname,
        `generated-wildcard-collisions-${keepIntermediateSchemas}-${renamed}.json`
      )
      await generate({
        tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
        controllers: [
          path.resolve(__dirname, '../fixtures/validation/recursive-order.ts')
        ],
        openapi: {
          filePath,
          keepIntermediateSchemas,
          additionalExportedTypeNames: renamed ? ['AnyValue'] : [],
          service: { name: 'generic', version: '1' }
        },
        router: {
          filePath: filePath.replace('.json', '.ts'),
          runtimeImport: '../../src'
        }
      })
      const app = express()
      app.use(express.json())
      const { bindToRouter } = await import(filePath.replace('.json', '.ts'))
      bindToRouter(app)
      app.use(createErrorHandler())
      for (const body of [{}, { value: null, other: ['Item', { value: 1 }] }]) {
        const before = controller.mock.callCount()
        const response = await request(app)
          .post('/items/wildcard')
          .send(body)
          .expect(200)
        assert.deepEqual(response.body, body)
        assert.equal(controller.mock.callCount(), before + 1)
        assert.deepEqual(controller.mock.calls[before].arguments, [body])
      }
      const before = controller.mock.callCount()
      await request(app).post('/items/wildcard').send([]).expect(400)
      assert.equal(controller.mock.callCount(), before)
      const invalid = await request(app)
        .post('/items/recursive')
        .send({})
        .expect(400)
      assert.equal(
        invalid.body.fields['body.value'].message,
        'Property value is required'
      )
    }
  }
})
