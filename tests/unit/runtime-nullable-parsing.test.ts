import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import express from 'express'
import request from 'supertest'
import { generate } from '../../src'
import { NullableParsingController } from '../fixtures/validation/nullable-parsing'
import { createErrorHandler } from '../integration/shared'

test('Nullable fallback parses enums and objects exactly like their nonnullable types', async () => {
  for (const keepIntermediateSchemas of [false, true]) {
    const filePath = path.resolve(
      __dirname,
      `generated-nullable-parsing-${keepIntermediateSchemas}.json`
    )
    await generate({
      tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
      controllers: [
        path.resolve(__dirname, '../fixtures/validation/nullable-parsing.ts')
      ],
      openapi: {
        filePath,
        keepIntermediateSchemas,
        service: { name: 'generic', version: '1' }
      },
      router: {
        filePath: filePath.replace('.json', '.ts'),
        runtimeImport: '../../src'
      }
    })
    const records: unknown[] = []
    const originals = (['plain', 'nullable'] as const).map(method => {
      const original = NullableParsingController.prototype[method]
      NullableParsingController.prototype[method] = function (body: any) {
        records.push(body)
        return original.call(this, body)
      }
      return [method, original] as const
    })
    try {
      const app = express()
      app.use(express.json())
      const { bindToRouter } = await import(filePath.replace('.json', '.ts'))
      bindToRouter(app)
      app.use(createErrorHandler())
      for (const mode of ['first', 'true', '0']) {
        const input = {
          node: { value: 1 },
          mode,
          value: { count: 2, flag: 'false' }
        }
        const parsed = {
          node: { value: 1 },
          mode,
          value: { count: 2, flag: false }
        }
        for (const route of ['plain', 'nullable']) {
          const before = records.length
          const result = await request(app)
            .post(`/nullable-parsing/${route}`)
            .send(input)
            .expect(200)
          assert.deepEqual(result.body, parsed)
          assert.deepEqual(records.at(-1), parsed)
          assert.equal(records.length, before + 1)
        }
      }
      const nullable = { node: { value: 1 }, mode: null, value: null }
      await request(app)
        .post('/nullable-parsing/nullable')
        .send(nullable)
        .expect(200)
      assert.deepEqual(records.at(-1), nullable)
      const before = records.length
      for (const body of [
        nullable,
        {},
        { node: { value: 1 }, mode: 'bad', value: { count: 1, flag: false } },
        {
          node: { value: 1 },
          mode: 'first',
          value: { count: 'bad', flag: false }
        }
      ]) {
        await request(app)
          .post('/nullable-parsing/plain')
          .send(body)
          .expect(400)
        if (body !== nullable)
          await request(app)
            .post('/nullable-parsing/nullable')
            .send(body)
            .expect(400)
      }
      assert.equal(records.length, before)
      assert.ok(fs.existsSync(filePath))
    } finally {
      for (const [method, original] of originals)
        NullableParsingController.prototype[method] = original
    }
  }
})
