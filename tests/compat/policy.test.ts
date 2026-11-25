import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  AcceptedChange,
  assertCompatible,
  compareVersions,
  differences,
  digest
} from './policy'

const before = { openapi: { type: 'object' }, http: { body: { status: 200 } } }
const after = { ...before, http: { body: { status: 400 } } }
const change: AcceptedChange = {
  ...differences(before, after)[0],
  expressMajor: '5',
  reason: 'Restore the published contract',
  sinceVersion: '1.0.0-alpha.80'
}

test('Compatibility policy accepts identical and explicitly approved contracts', () => {
  assert.equal(assertCompatible(before, before, [], '1.0.0-alpha.79', '5'), 0)
  assert.equal(
    assertCompatible(before, after, [change], '1.0.0-alpha.79', '5'),
    1
  )
})

test('Compatibility policy rejects unlisted HTTP and OpenAPI differences', () => {
  assert.throws(
    () => assertCompatible(before, after, [], '1.0.0-alpha.79', '5'),
    /Unaccepted difference: body/
  )
  assert.throws(
    () =>
      assertCompatible(
        before,
        { ...before, openapi: {} },
        [],
        '1.0.0-alpha.79',
        '5'
      ),
    /Unaccepted difference: openapi/
  )
})

test('Approved cases cannot hide a different regression or its reversion', () => {
  assert.throws(
    () =>
      assertCompatible(
        before,
        { ...after, http: { body: { status: 500 } } },
        [change],
        '1.0.0-alpha.79',
        '5'
      ),
    /Unaccepted difference: body/
  )
  assert.throws(
    () => assertCompatible(before, before, [change], '1.0.0-alpha.79', '5'),
    /Accepted change no longer differs/
  )
})

test('Recursive HTTP and document changes share approval and expiry policy with ordinary cases', () => {
  const recursiveBefore = {
    ...before,
    documents: { 'recursive.openapi': { type: 'object' } },
    http: { ...before.http, 'recursive-box.narrowed': { status: 200 } }
  }
  const recursiveAfter = {
    ...recursiveBefore,
    http: { ...after.http, 'recursive-box.narrowed': { status: 400 } }
  }
  const approved = differences(recursiveBefore, recursiveAfter).map(diff => ({
    ...change,
    ...diff
  }))
  assert.throws(
    () =>
      assertCompatible(
        recursiveBefore,
        recursiveAfter,
        [change],
        '1.0.0-alpha.79',
        '5'
      ),
    /Unaccepted difference: recursive-box.narrowed/
  )
  assert.equal(
    assertCompatible(
      recursiveBefore,
      recursiveAfter,
      approved,
      '1.0.0-alpha.79',
      '5'
    ),
    2
  )
  assert.throws(
    () =>
      assertCompatible(
        recursiveBefore,
        recursiveBefore,
        approved,
        '1.0.0-alpha.79',
        '5'
      ),
    /Accepted change no longer differs: recursive-box.narrowed/
  )
  assert.throws(
    () =>
      assertCompatible(
        recursiveBefore,
        recursiveAfter,
        approved.filter(entry => entry.caseId === 'recursive-box.narrowed'),
        '1.0.0-alpha.80',
        '4'
      ),
    /Stale accepted change: recursive-box.narrowed/
  )
  const changedDocument = {
    ...recursiveBefore,
    documents: { 'recursive.openapi': {} }
  }
  assert.throws(
    () =>
      assertCompatible(
        recursiveBefore,
        changedDocument,
        [],
        '1.0.0-alpha.79',
        '5'
      ),
    /Unaccepted difference: recursive.openapi/
  )
  assert.equal(
    assertCompatible(
      recursiveBefore,
      changedDocument,
      differences(recursiveBefore, changedDocument).map(diff => ({
        ...change,
        ...diff
      })),
      '1.0.0-alpha.79',
      '5'
    ),
    1
  )
})

test('Accepted changes expire at their release, including other Express majors', () => {
  for (const latest of ['1.0.0-alpha.80', '1.0.0-alpha.81', '1.0.0']) {
    assert.throws(
      () => assertCompatible(before, after, [change], latest, '4'),
      /Stale accepted change/
    )
  }
})

test('Accepted changes require valid metadata and unique case identifiers', () => {
  for (const entry of [
    { ...change, reason: '' },
    { ...change, sinceVersion: 'latest' },
    { ...change, before: '*' },
    { ...change, expressMajor: '6' }
  ]) {
    assert.throws(() =>
      assertCompatible(before, after, [entry], '1.0.0-alpha.79', '5')
    )
  }
  assert.throws(
    () =>
      assertCompatible(before, after, [change, change], '1.0.0-alpha.79', '5'),
    /Duplicate accepted change/
  )
})

test('Semantic versions compare numeric prereleases and release precedence', () => {
  for (const [a, b] of [
    ['1.0.0-alpha.9', '1.0.0-alpha.10'],
    ['1.0.0-alpha.80', '1.0.0-beta'],
    ['1.0.0-beta', '1.0.0'],
    ['1.9.0', '1.10.0'],
    ['1.0.0-alpha', '1.0.0-alpha.1']
  ]) {
    assert.ok(compareVersions(a, b) < 0)
    assert.ok(compareVersions(b, a) > 0)
  }
  assert.equal(compareVersions('1.0.0+build.1', '1.0.0+build.2'), 0)
  assert.throws(() => compareVersions('1.0.0-alpha.01', '1.0.0'))
})

test('Contract digests ignore object-key order, but not arrays, dates or undefined', () => {
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }))
  assert.notEqual(digest([1, 2]), digest([2, 1]))
  assert.notEqual(digest(undefined), digest(null))
  assert.notEqual(digest(new Date('2020-01-01')), digest('2020-01-01'))
})
