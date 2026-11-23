import { createHash } from 'node:crypto'
import { strict as assert } from 'node:assert'

export type Snapshot = { openapi: unknown; http: Record<string, unknown> }
export type AcceptedChange = {
  caseId: string
  expressMajor: string
  reason: string
  sinceVersion: string
  before: string
  after: string
}

export function canonical(value: any): any {
  if (value === undefined) return { $undefined: true }
  if (value instanceof Date) return { $date: value.toISOString() }
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonical(value[key])])
    )
  }
  return value
}

export function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex')
}

function version(value: string): string[] {
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?$/.exec(
      value
    )
  assert.ok(match, `Invalid version: ${value}`)
  const identifiers = match[4]?.split('.') ?? []
  assert.ok(
    identifiers.every(id => !/^0\d+$/.test(id)),
    `Invalid version: ${value}`
  )
  return [...match.slice(1, 4), ...identifiers]
}

export function compareVersions(a: string, b: string): number {
  const left = version(a)
  const right = version(b)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] === right[i]) continue
    if (i === 3 && (left.length === 3 || right.length === 3))
      return left.length === 3 ? 1 : -1
    if (left[i] === undefined || right[i] === undefined)
      return left[i] === undefined ? -1 : 1
    const x = left[i],
      y = right[i]
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
      if (x.length !== y.length) return x.length < y.length ? -1 : 1
      return x < y ? -1 : 1
    }
    if (/^\d+$/.test(x) !== /^\d+$/.test(y)) return /^\d+$/.test(x) ? -1 : 1
    return x < y ? -1 : 1
  }
  return 0
}

export function differences(before: Snapshot, after: Snapshot) {
  const units = (snapshot: Snapshot) => ({
    openapi: snapshot.openapi,
    ...snapshot.http
  })
  const left = units(before),
    right = units(after)
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .sort()
    .flatMap(caseId => {
      const a = digest(left[caseId as keyof typeof left])
      const b = digest(right[caseId as keyof typeof right])
      return a === b ? [] : [{ caseId, before: a, after: b }]
    })
}

export function assertCompatible(
  before: Snapshot,
  after: Snapshot,
  entries: AcceptedChange[],
  latest: string,
  major: string
): number {
  const keys = new Set<string>()
  for (const entry of entries) {
    assert.ok(
      entry.caseId &&
        ['4', '5'].includes(entry.expressMajor) &&
        entry.reason?.trim(),
      'Accepted changes require caseId, expressMajor and reason'
    )
    assert.ok(
      /^[a-f0-9]{64}$/.test(entry.before) && /^[a-f0-9]{64}$/.test(entry.after),
      `Invalid digests: ${entry.caseId}`
    )
    assert.ok(
      compareVersions(entry.sinceVersion, latest) > 0,
      `Stale accepted change: ${entry.caseId}; ${entry.sinceVersion} <= latest ${latest}`
    )
    const key = `${entry.expressMajor}/${entry.caseId}`
    assert.ok(!keys.has(key), `Duplicate accepted change: ${key}`)
    keys.add(key)
  }
  const changes = differences(before, after)
  const active = entries.filter(entry => entry.expressMajor === major)
  const failures: string[] = []
  for (const change of changes) {
    const entry = active.find(entry => entry.caseId === change.caseId)
    if (
      !entry ||
      entry.before !== change.before ||
      entry.after !== change.after
    ) {
      failures.push(
        `Unaccepted difference: ${change.caseId} before=${change.before} after=${change.after}`
      )
    }
  }
  for (const entry of active) {
    if (!changes.some(change => change.caseId === entry.caseId))
      failures.push(`Accepted change no longer differs: ${entry.caseId}`)
  }
  assert.equal(
    failures.length,
    0,
    `COMPAT_RELEASE_MISMATCH\n${failures.join('\n')}`
  )
  return changes.length
}
