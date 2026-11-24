export type Scenario = {
  id: string
  method?: string
  path: string
  body?: string
  headers?: Record<string, string>
  strict?: boolean
  legacy?: boolean
}

const json = (
  id: string,
  path: string,
  body: unknown,
  legacy = false
): Scenario => ({
  id,
  path,
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
  legacy
})
const empty = { 'content-type': 'application/json', 'content-length': '0' }

export const scenarios: Scenario[] = [
  ...['GET', 'POST', 'DELETE', 'HEAD'].flatMap(method => [
    { id: `body.${method}.missing`, method, path: 'optional', legacy: true },
    {
      id: `body.${method}.empty-json`,
      method,
      path: 'optional',
      headers: empty,
      legacy: true
    },
    { ...json(`body.${method}.object`, 'optional', {}, true), method },
    {
      id: `body.${method}.unsupported`,
      method,
      path: 'optional',
      body: 'hello',
      headers: { 'content-type': 'text/plain' },
      legacy: true
    }
  ]),
  {
    id: 'body.optional.chunked-empty',
    path: 'optional',
    headers: {
      'content-type': 'application/json',
      'transfer-encoding': 'chunked'
    },
    legacy: true
  },
  {
    id: 'body.optional.unsupported-empty',
    path: 'optional',
    headers: { 'content-type': 'text/plain', 'content-length': '0' },
    legacy: true
  },
  { id: 'body.required.empty', path: 'required', headers: empty, legacy: true },
  {
    id: 'body.optional-item.empty',
    path: 'optional-item',
    headers: empty,
    legacy: true
  },
  json('body.required.valid', 'required', { name: 'a' }, true),
  json('body.required.invalid', 'required', { name: 1 }, true),
  {
    id: 'body.form.empty',
    path: 'form',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': '0'
    },
    legacy: true
  },
  {
    id: 'body.form.value',
    path: 'form',
    body: 'name=a',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    legacy: true
  },
  json('union.text', 'union', { kind: 'text', text: 'a' }, true),
  json('union.count', 'union', { kind: 'count', count: 1 }, true),
  json('union.invalid', 'union', { kind: 'text', text: 1 }, true),
  json(
    'discriminator.text',
    'discriminated',
    { kind: 'text', text: 'a' },
    true
  ),
  json(
    'discriminator.invalid',
    'discriminated',
    { kind: 'text', text: 1 },
    true
  ),
  json('discriminator.throws', 'discriminated', { kind: 'other' }, true),
  json('intersection.valid', 'intersection', { name: 'a', extra: 1 }, true),
  json('intersection.invalid', 'intersection', { name: 1 }, true),
  json('inheritance.valid', 'inherited', { name: 'a', count: 1 }, true),
  json('inheritance.invalid', 'inherited', { count: 1 }, true),
  json('nested.valid', 'nested', { rows: [[{ name: 'a', tags: ['b'] }]] }),
  json('nested.invalid', 'nested', { rows: [[{ name: 'a', tags: 1 }]] }, true),
  json('arrays.valid', 'array-intersection', {
    items: [{ name: 'a', tags: ['b'] }]
  }),
  json(
    'arrays.invalid',
    'array-intersection',
    { items: [{ name: 'a' }] },
    true
  ),
  {
    ...json(
      'arrays.strict-extra',
      'array-intersection',
      { items: [{ name: 'a', tags: ['b'], extra: true }] },
      true
    ),
    strict: true
  },
  json('enum.valid', 'enum', { kind: 'a', tags: ['a'] }),
  json('enum.empty', 'enum', { kind: 'b', tags: [] }),
  json('enum.invalid', 'enum', { kind: 'other', tags: ['a'] }),
  json('enum.intersection-invalid', 'enum', { kind: 'a', tags: ['b'] }),
  json('nullable.null', 'nullable', { name: null, tags: null }),
  json('nullable.values', 'nullable', { name: 'a', tags: ['a'] }),
  json('nullable.invalid', 'nullable', { name: 1, tags: null }),
  json('defaults.missing', 'defaults', {}),
  json('defaults.falsy', 'defaults', {
    count: 0,
    enabled: false,
    label: '',
    limit: 0
  }),
  json('defaults.invalid', 'defaults', { count: 'invalid' }),
  json('access.valid', 'access', { name: 'a', secret: 'hidden' }),
  json('access.readonly', 'access', {
    id: 'supplied',
    name: 'a',
    secret: 'hidden'
  }),
  json('additional.loose', 'required', { name: 'a', extra: true }),
  {
    ...json('additional.strict', 'required', { name: 'a', extra: true }),
    strict: true
  },
  json('dictionary.valid', 'dictionary', { a: 1, b: 2 }),
  { ...json('dictionary.strict', 'dictionary', { a: 1 }), strict: true },
  json('dictionary.invalid', 'dictionary', { a: 'invalid' }),
  {
    id: 'query.single',
    method: 'GET',
    path: 'query?tags=a&limit=2&enabled=true'
  },
  {
    id: 'query.array',
    method: 'GET',
    path: 'query?tags=a&tags=b&limit=0&enabled=false'
  },
  {
    id: 'query.invalid',
    method: 'GET',
    path: 'query?tags=other&limit=2&enabled=true'
  },
  {
    id: 'query.number-invalid',
    method: 'GET',
    path: 'query?tags=a&limit=invalid&enabled=true'
  },
  { id: 'query.intersection-single', method: 'GET', path: 'enum-query?tags=a' },
  {
    id: 'query.intersection-invalid',
    method: 'GET',
    path: 'enum-query?tags=b'
  },
  {
    id: 'path.valid',
    method: 'GET',
    path: 'path/42',
    headers: { 'x-enabled': 'true' }
  },
  {
    id: 'path.regex-miss',
    method: 'GET',
    path: 'path/letters',
    headers: { 'x-enabled': 'true' }
  },
  {
    id: 'header.invalid',
    method: 'GET',
    path: 'path/42',
    headers: { 'x-enabled': 'invalid' }
  },
  { id: 'header.missing', method: 'GET', path: 'path/42' },
  { id: 'response.catalog', method: 'GET', path: 'catalog' },
  { id: 'response.required-code', method: 'GET', path: 'failure' },
  { id: 'response.serialization', method: 'GET', path: 'response' }
]
