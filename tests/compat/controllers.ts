import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Response,
  Route,
  Validator
} from './runtime'

let args: unknown[] | undefined
let discriminatorCalls = 0

export function reset() {
  args = undefined
  discriminatorCalls = 0
}

export function observation() {
  return { called: args !== undefined, args, discriminatorCalls }
}

export function received(...values: unknown[]) {
  args = values
}

export enum Kind {
  A = 'a',
  B = 'b'
}

interface Item {
  name: string
}

interface Tagged {
  tags: string[]
}

interface Child extends Item {
  count: number
}

interface TextItem {
  kind: 'text'
  text: string
}

interface CountItem {
  kind: 'count'
  count: number
}

export function selectItem(req: { body: any }): string {
  discriminatorCalls++
  if (req.body.kind === 'text') return 'TextItem'
  if (req.body.kind === 'count') return 'CountItem'
  throw new Validator.ValidateError({}, 'Unsupported kind')
}

class Defaults {
  count = 0
  enabled = false
  label = ''
  limit = 2
}

interface Access {
  readonly id: string
  name: string
  /** @writeonly */
  secret?: string
}

interface Envelope {
  code?: number
  message: string
}

export type Failure = Envelope & { code: number; status: 'fail' }

export interface ClientValue {
  kind: Kind
  readonly tags: (Kind.A[] & Kind[]) | (Kind.B[] & Kind[])
  optional?: string
  nullable: string | null
  choice: TextItem | CountItem
  /** @writeonly */
  secret: string
}

interface View {
  readonly id: string
  created: Date
  /** @writeonly */
  secret?: string
}

@Route('compat')
export class ContractController extends Controller {
  @Get('optional')
  @Post('optional')
  @Delete('optional')
  optional(@Body() body?: Record<string, unknown>): unknown {
    received(body)
    return { body }
  }

  @Post('required')
  required(@Body() body: Item): unknown {
    received(body)
    return body
  }

  @Post('optional-item')
  optionalItem(@Body() body?: Item): unknown {
    received(body)
    return { body }
  }

  @Post('form')
  form(
    @Body('application/x-www-form-urlencoded') body?: Record<string, unknown>
  ): unknown {
    received(body)
    return { body }
  }

  @Post('union')
  union(@Body() body: TextItem | CountItem): unknown {
    received(body)
    return body
  }

  @Post('discriminated')
  discriminated(
    @Body('application/json', selectItem) body: TextItem | CountItem
  ): unknown {
    received(body)
    return body
  }

  @Post('intersection')
  intersection(@Body() body: Item & Record<string, unknown>): unknown {
    received(body)
    return body
  }

  @Post('inherited')
  inherited(@Body() body: Child): unknown {
    received(body)
    return body
  }

  @Post('nested')
  nested(@Body() body: { rows: (Item & Tagged)[][] }): unknown {
    received(body)
    return body
  }

  @Post('array-intersection')
  arrays(@Body() body: { items: Item[] } & { items: Tagged[] }): unknown {
    received(body)
    return body
  }

  @Post('enum')
  enumValue(@Body() body: { kind: Kind; tags: Kind.A[] & Kind[] }): unknown {
    received(body)
    return body
  }

  @Post('nullable')
  nullable(
    @Body() body: { name: string | null; tags: (Kind.A[] & Kind[]) | null }
  ): unknown {
    received(body)
    return body
  }

  @Post('defaults')
  defaults(@Body() body: Defaults): unknown {
    received(body)
    return body
  }

  @Post('access')
  access(@Body() body: Access): unknown {
    received(body)
    return body
  }

  @Post('dictionary')
  dictionary(@Body() body: Record<string, number>): unknown {
    received(body)
    return body
  }

  @Get('query')
  query(
    @Query('tags') tags: Kind[],
    @Query('limit') limit: number,
    @Query('enabled') enabled: boolean
  ): unknown {
    received(tags, limit, enabled)
    return { tags, limit, enabled }
  }

  @Get('enum-query')
  enumQuery(@Query('tags') tags: Kind.A[] & Kind[]): unknown {
    received(tags)
    return { tags }
  }

  @Get('catalog')
  catalog(): ClientValue {
    received()
    return {
      kind: Kind.A,
      tags: [Kind.A],
      nullable: null,
      choice: { kind: 'text', text: 'a' },
      secret: 'hidden'
    }
  }

  @Get('failure')
  @Response<Failure>(400)
  failure(): Failure {
    received()
    this.setStatus(400)
    return { code: 400, message: 'Invalid item', status: 'fail' }
  }

  @Get('response')
  response(): View {
    received()
    return {
      id: 'a',
      created: new Date('2020-01-02T03:04:05.000Z'),
      secret: 'hidden'
    }
  }
}
