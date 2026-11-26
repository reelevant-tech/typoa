import path from 'node:path'
import fs from 'node:fs'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import express from 'express'
import request from 'supertest'
import { generate } from '../../src'
import { RecursiveOrderController } from '../fixtures/validation/recursive-order'
import { createErrorHandler } from '../integration/shared'

test('Preserves wildcard omissions and discriminator model validation over HTTP', async t => {
  const controller = t.mock.method(
    RecursiveOrderController.prototype,
    'wildcard'
  )
  const selected = t.mock.method(RecursiveOrderController.prototype, 'selected')
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
      const schemas = JSON.parse(fs.readFileSync(filePath, 'utf8')).components
        .schemas
      assert.equal(schemas.AnyValue_2.type, 'object')
      assert.deepEqual(schemas.AnyValue_2.required, ['value'])
      assert.deepEqual(schemas.AnyValue_2.properties.value, { type: 'number' })
      assert.equal(schemas.AnyValue_3.type, 'object')
      const wildcard = schemas.WildcardHolder.properties.value.$ref
      assert.notEqual(wildcard, '#/components/schemas/AnyValue_2')
      assert.notEqual(wildcard, '#/components/schemas/AnyValue_3')
      if (renamed) assert.deepEqual(schemas.AnyValue, { type: 'number' })
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
      const selectedBefore = selected.mock.callCount()
      for (const [body, message] of [
        [{}, 'Property value is required'],
        [{ value: 'invalid' }, 'This property must be a number']
      ] as const) {
        const response = await request(app)
          .post('/items/selected')
          .send(body)
          .expect(400)
        assert.equal(response.body.fields['body.value'].message, message)
        assert.equal(selected.mock.callCount(), selectedBefore)
      }
      const accepted = await request(app)
        .post('/items/selected')
        .send({ value: 1 })
        .expect(200)
      assert.deepEqual(accepted.body, { value: 1 })
      assert.equal(selected.mock.callCount(), selectedBefore + 1)
      assert.deepEqual(selected.mock.calls[selectedBefore].arguments, [
        { value: 1 }
      ])
    }
  }
})
