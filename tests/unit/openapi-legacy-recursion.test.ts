import fs from 'node:fs'
import path from 'node:path'
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import SwaggerParser from '@apidevtools/swagger-parser'
import Ajv from 'ajv'
import { generate } from '../../src'
import { validateAndParse } from '../../src/runtime/validator'

for (const keepIntermediateSchemas of [false, true]) {
  test(`Recursive fallback regenerates earlier models atomically (intermediates ${keepIntermediateSchemas})`, async () => {
    const filePath = path.resolve(
      __dirname,
      `generated-recursive-order-${keepIntermediateSchemas}.json`
    )
    await generate({
      tsconfigFilePath: path.resolve(__dirname, '../fixtures/tsconfig.json'),
      controllers: [
        path.resolve(__dirname, '../fixtures/validation/recursive-order.ts')
      ],
      openapi: {
        filePath,
        keepIntermediateSchemas,
        service: { name: 'generic', version: '1' }
      },
      router: { filePath: filePath.replace('.json', '.ts') }
    })
    const spec = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    assert.equal(spec.components.schemas.Item.allOf, undefined)
    assert.deepEqual(spec.components.schemas.Item.properties, {
      name: { type: 'string' },
      id: { type: 'string' }
    })
    assert.equal(
      spec.components.schemas.RecursiveItem.properties.next.$ref,
      '#/components/schemas/RecursiveItem'
    )
    assert.deepEqual(spec.components.schemas.Chain.required, ['value'])
    assert.equal(spec.components.schemas.Holder.required, undefined)
    await SwaggerParser.validate(structuredClone(spec))
    const ajv = new Ajv({ strict: false })
    ajv.addSchema({ components: spec.components }, 'spec')
    const validate = ajv.compile({
      $ref: 'spec#/components/schemas/NestedHolder'
    })
    for (const body of [
      {},
      { root: null },
      { root: [] },
      { root: [null, [null]], sibling: [null] }
    ]) {
      assert.equal(validate(body), true)
    }
    for (const body of [{ root: [1] }, { sibling: null }]) {
      assert.equal(validate(body), false)
    }
    for (const [route, valid, invalid] of [
      ['value', ['a', ['b']], [1]],
      ['mapping', { next: {} }, { next: 1 }],
      ['optional', { root: { value: 1 } }, { root: { value: 1, next: {} } }],
      [
        'optional',
        { root: { value: 1, next: { value: 2 } } },
        { root: { value: 'invalid' } }
      ],
      ['nested', { root: null }, { root: [1] }],
      ['nested', { root: [null, [null]], sibling: [null] }, { sibling: null }]
    ] as const) {
      const rules = {
        params: [{ in: 'body' as any, name: 'body' }],
        body: spec.paths[`/items/${route}`].post.requestBody
      }
      for (const body of [valid, route === 'value' ? [] : {}]) {
        assert.deepEqual(
          await validateAndParse(
            { body, headers: { 'content-type': 'application/json' } } as any,
            spec.components.schemas,
            rules
          ),
          [body]
        )
      }
      await assert.rejects(() =>
        validateAndParse(
          {
            body: invalid,
            headers: { 'content-type': 'application/json' }
          } as any,
          spec.components.schemas,
          rules
        )
      )
    }
  })
}
