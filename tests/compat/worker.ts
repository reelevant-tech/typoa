import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import { strict as assert } from 'node:assert'
import { scenariosFor } from './cases'
import { canonical, digest } from './policy'

async function run() {
  const load = createRequire(__filename)
  const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  const file = (name: string) => path.join(config.directory, name)
  const consumer = createRequire(file('router.ts'))
  const entry = fs.realpathSync(consumer.resolve('typoa'))
  const runtime = fs.realpathSync(consumer.resolve('typoa/runtime'))
  const identity = {
    entry,
    runtime,
    hash: digest(
      [entry, path.join(path.dirname(runtime), 'validator.js')].map(name =>
        fs.readFileSync(name, 'utf8')
      )
    )
  }
  assert.deepEqual(identity, config.identity, 'Wrong typoa package resolved')
  const api = consumer('typoa')
  assert.equal(api.Validator, consumer('typoa/runtime').Validator)
  const express = load(config.express)
  await api.generate({
    tsconfigFilePath: file('tsconfig.json'),
    controllers:
      config.group === 'default'
        ? [
            file('controllers.ts'),
            ...(config.legacy ? [] : [file('pattern-controller.ts')])
          ]
        : [file(`${config.group}-controller.ts`)],
    openapi: {
      filePath: file('openapi.json'),
      additionalExportedTypeNames:
        config.group === 'compositional'
          ? ['PatchItem']
          : config.group === 'default'
            ? ['Failure']
            : [],
      service: { name: 'compatibility', version: '1' }
    },
    router: {
      filePath: file('router.ts'),
      validateResponse: true
    }
  })
  assert.match(
    fs.readFileSync(file('router.ts'), 'utf8'),
    /import \{ RuntimeResponse, Validator \} from ['"]typoa\/runtime['"]/
  )
  const state = load(file('controllers.ts'))
  const app = express()
  app.use((_req: any, res: any, next: any) => {
    res.set('x-compat-server', '1')
    next()
  })
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  load(file('router.ts')).bindToRouter(app)
  app.use((_req: any, res: any) =>
    res.status(404).json({ message: 'Not found' })
  )
  app.use((error: any, _req: any, res: any, next: any) => {
    if (res.headersSent) return next(error)
    res.status(error.status || 500).json({
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {})
    })
  })
  const server: http.Server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const results: Record<string, unknown> = {}
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    for (const scenario of scenariosFor(config.group).filter(
      s => !config.legacy || s.legacy
    )) {
      state.reset()
      api.setRuntimeOptions({
        features: {
          enableThrowOnUnexpectedAdditionalData: scenario.strict ?? false
        }
      })
      const headers = { ...scenario.headers }
      if (
        scenario.body !== undefined &&
        headers['content-length'] === undefined &&
        headers['transfer-encoding'] === undefined
      ) {
        headers['content-length'] = String(Buffer.byteLength(scenario.body))
      }
      const response = await new Promise<{ status: number; payload: unknown }>(
        (resolve, reject) => {
          const request = http.request(
            {
              host: '127.0.0.1',
              port: address.port,
              path: `/compat/${scenario.path}`,
              method: scenario.method ?? 'POST',
              headers
            },
            res => {
              let text = ''
              res.setEncoding('utf8')
              res.on('data', chunk => {
                text += chunk
              })
              res.on('error', reject)
              res.on('end', () => {
                try {
                  assert.equal(
                    res.headers['x-compat-server'],
                    '1',
                    `${scenario.id} did not reach Express`
                  )
                  resolve({
                    status: res.statusCode!,
                    payload: text ? JSON.parse(text) : null
                  })
                } catch (error) {
                  reject(error)
                }
              })
            }
          )
          request.setTimeout(5000, () =>
            request.destroy(new Error(`Timeout: ${scenario.id}`))
          )
          request.on('error', reject)
          request.end(scenario.body)
        }
      )
      results[scenario.id] = canonical({
        ...response,
        controller: state.observation()
      })
    }
    fs.writeFileSync(
      file('result.json'),
      JSON.stringify(
        canonical({
          runtime: identity,
          openapi: JSON.parse(fs.readFileSync(file('openapi.json'), 'utf8')),
          http: results
        })
      )
    )
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve()))
    )
  }
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
