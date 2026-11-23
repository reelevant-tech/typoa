import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import Client from './client/api'
import {
  AnyValue,
  ClientValue,
  Failure,
  Kind,
  View,
  WithoutReadonly,
  WithoutWriteonly
} from './client/definitions'

declare const value: ClientValue
declare const response: WithoutWriteonly<ClientValue>
declare const failure: Failure
value.tags.includes(Kind.A)
response.tags.includes(Kind.A)
const code: number = failure.code
const optional: string | undefined = value.optional
const nullable: string | null = value.nullable
if (value.choice.kind === 'text') value.choice.text.toUpperCase()
else value.choice.count.toFixed()
// @ts-expect-error Failure requires code.
const missing: Failure = { status: 'fail', message: 'Invalid item' }
// @ts-expect-error Nullable fields cannot be assigned to a non-nullable string.
const notNullable: string = value.nullable
// @ts-expect-error Write-only properties must be absent from responses.
void response.secret
void [code, optional, nullable, missing, notNullable]

const api = new Client({})
const tags: Kind.A[] = [Kind.A]
const withoutOptional: ClientValue = {
  kind: Kind.A,
  tags,
  nullable: null,
  choice: { kind: 'text', text: 'a' },
  secret: 'hidden'
}
const optionalCanBeOmitted: Record<never, never> extends Pick<
  ClientValue,
  'optional'
>
  ? true
  : false = true
void [withoutOptional, optionalCanBeOmitted]
const calls = {
  access: api.Default.access({}, { name: 'a', secret: 'hidden' }),
  arrays: api.Default.arrays({}, { items: [{ name: 'a', tags: ['b'] }] }),
  catalog: api.Default.catalog({}),
  defaults: api.Default.defaults(
    {},
    { count: 0, enabled: false, label: '', limit: 2 }
  ),
  dictionary: api.Default.dictionary({}, { a: 1 }),
  discriminated: api.Default.discriminated({}, { kind: 'text', text: 'a' }),
  enumValue: api.Default.enumValue({}, { kind: Kind.A, tags }),
  enumQuery: api.Default.enumQuery({ tags }),
  failure: api.Default.failure({}),
  form: api.Default.form({}, { name: 'a' }),
  inherited: api.Default.inherited({}, { name: 'a', count: 1 }),
  intersection: api.Default.intersection({}, { name: 'a', extra: 1 }),
  nested: api.Default.nested({}, { rows: [[{ name: 'a', tags: ['b'] }]] }),
  nullable: api.Default.nullable({}, { name: null, tags }),
  optionalGet: api.Default.optionalGet({}),
  optionalPost: api.Default.optionalPost({}, {}),
  optionalDelete: api.Default.optionalDelete({}),
  optionalItem: api.Default.optionalItem({}, { name: 'a' }),
  path: api.Default.path({ id: 42, 'x-enabled': true }),
  query: api.Default.query({ tags: [Kind.A], limit: 0, enabled: false }),
  required: api.Default.required({}, { name: 'a' }),
  response: api.Default.response({}),
  union: api.Default.union({}, { kind: 'count', count: 1 })
} satisfies Record<keyof Client['Default'], Promise<AxiosResponse<unknown>>>

const responses: {
  catalog: Promise<AxiosResponse<WithoutWriteonly<ClientValue>>>
  failure: Promise<AxiosResponse<Failure>>
  response: Promise<AxiosResponse<WithoutWriteonly<View>>>
} = calls
void responses

type CatalogData = Awaited<ReturnType<Client['Default']['catalog']>>['data']
const catalogOmitsSecret: 'secret' extends keyof CatalogData ? true : false =
  false
void catalogOmitsSecret

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
const optionalPostSignature: Equal<
  Parameters<Client['Default']['optionalPost']>,
  [
    Record<string, never>,
    Record<string, WithoutReadonly<AnyValue>>,
    AxiosRequestConfig?
  ]
> = true
const optionalItemSignature: Equal<
  Parameters<Client['Default']['optionalItem']>,
  [Record<string, never>, { name: string }, AxiosRequestConfig?]
> = true
void [optionalPostSignature, optionalItemSignature]
