import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { strict as assert } from 'node:assert'
import { generate as generateClient } from 'oatyp'
import expressPackage from 'express/package.json'
import { canonical, Snapshot } from './policy'
import { scenarios } from './cases'

export const root = path.resolve(__dirname, '../..')
export const major = expressPackage.version.split('.')[0]
assert.ok(['4', '5'].includes(major), `Unsupported Express major: ${major}`)
if (process.env.EXPRESS_VERSION) {
  assert.equal(expressPackage.version, process.env.EXPRESS_VERSION)
}

export function temporary<T>(
  action: (directory: string) => Promise<T>
): Promise<T> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'typoa-compat-'))
  return action(directory).finally(() =>
    fs.rmSync(directory, { recursive: true, force: true })
  )
}

export function capture(
  entry = path.join(root, 'src/index.ts'),
  legacy = false
): Promise<Snapshot> {
  return temporary(async directory => {
    assert.equal(
      new Set(scenarios.map(s => s.id)).size,
      scenarios.length,
      'Duplicate scenario IDs'
    )
    for (const name of ['controllers.ts', 'pattern-controller.ts'])
      fs.copyFileSync(path.join(__dirname, name), path.join(directory, name))
    fs.writeFileSync(
      path.join(directory, 'runtime.ts'),
      `export * from ${JSON.stringify(entry)}\n`
    )
    fs.writeFileSync(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({
        extends: path.join(__dirname, 'tsconfig.json'),
        include: ['*.ts']
      })
    )
    fs.symlinkSync(
      path.join(root, 'node_modules'),
      path.join(directory, 'node_modules'),
      'junction'
    )
    const config = path.join(directory, 'config.json')
    fs.writeFileSync(
      config,
      JSON.stringify({
        entry,
        legacy,
        directory,
        express: require.resolve('express')
      })
    )
    try {
      execFileSync(
        process.execPath,
        [
          '--import',
          require.resolve('tsx'),
          path.join(__dirname, 'worker.ts'),
          config
        ],
        {
          cwd: directory,
          env: {
            ...process.env,
            TSX_TSCONFIG_PATH: path.join(directory, 'tsconfig.json')
          },
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
          timeout: 60000
        }
      )
    } catch (error) {
      throw new Error(
        `Compatibility capture failed\n${String((error as any).stdout)}\n${String((error as any).stderr)}`
      )
    }
    return JSON.parse(
      fs.readFileSync(path.join(directory, 'result.json'), 'utf8')
    )
  })
}

export function snapshot(file: string, actual: unknown) {
  const target = path.join(__dirname, 'snapshots', file)
  if (process.env.UPDATE_COMPAT_SNAPSHOTS === '1')
    fs.writeFileSync(target, JSON.stringify(canonical(actual), null, 2) + '\n')
  assert.ok(
    fs.existsSync(target),
    `Missing ${file}; review and run UPDATE_COMPAT_SNAPSHOTS=1 yarn compat`
  )
  assert.deepEqual(
    canonical(actual),
    JSON.parse(fs.readFileSync(target, 'utf8')),
    `COMPAT_SNAPSHOT_MISMATCH: ${file}; review before UPDATE_COMPAT_SNAPSHOTS=1 yarn compat`
  )
}

export async function client(
  openapi: any,
  transformApi?: (source: string) => string
) {
  await temporary(async directory => {
    fs.symlinkSync(
      path.join(root, 'node_modules'),
      path.join(directory, 'node_modules'),
      'junction'
    )
    const schema = path.join(directory, 'openapi.json')
    fs.writeFileSync(schema, JSON.stringify(openapi))
    await generateClient({
      openapiFilePath: schema,
      outDir: path.join(directory, 'client')
    })
    if (transformApi) {
      const api = path.join(directory, 'client/api.ts')
      fs.writeFileSync(api, transformApi(fs.readFileSync(api, 'utf8')))
    }
    fs.copyFileSync(
      path.join(__dirname, 'type-usage.ts'),
      path.join(directory, 'type-usage.ts')
    )
    try {
      execFileSync(
        process.execPath,
        [
          require.resolve('typescript/bin/tsc'),
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'es2022',
          '--moduleResolution',
          'node',
          path.join(directory, 'type-usage.ts')
        ],
        { encoding: 'utf8' }
      )
    } catch (error) {
      throw new Error(
        `COMPAT_CLIENT_MISMATCH\n${String((error as any).stdout)}\n${String((error as any).stderr)}`
      )
    }
  })
}

export function installRelease<T>(
  version: string,
  action: (entry: string, version: string) => Promise<T>
): Promise<T> {
  return temporary(async directory => {
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ private: true })
    )
    execFileSync(
      'npm',
      [
        'install',
        '--prefix',
        directory,
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--save-exact',
        `typoa@${version}`
      ],
      { encoding: 'utf8', timeout: 180000 }
    )
    const packageRoot = path.join(directory, 'node_modules/typoa')
    const installed = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    )
    return action(path.join(packageRoot, 'build/index.js'), installed.version)
  })
}
