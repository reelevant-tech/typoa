import {
  ClientValue,
  Failure,
  Kind,
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
