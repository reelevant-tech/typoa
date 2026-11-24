import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Query,
  Route
} from '../../../src'

interface Item {
  id: string
  query?: string
}
type IndexedItem = Item & Record<string, unknown>

@Route('contract')
export class ContractController extends Controller {
  @Get('optional')
  @Post('optional')
  @Put('optional')
  @Patch('optional')
  @Delete('optional')
  optional(
    @Body() body?: Record<string, unknown> | Record<string, unknown>[]
  ): unknown {
    this.setHeader('x-controller-body', JSON.stringify(body) ?? 'undefined')
    this.setStatus(200)
    return { body }
  }

  @Post('object')
  object(@Body() body?: Item): unknown {
    return { body }
  }

  @Post('form')
  form(
    @Body('application/x-www-form-urlencoded') body?: Record<string, unknown>
  ): unknown {
    this.setHeader('x-controller-body', JSON.stringify(body) ?? 'undefined')
    this.setStatus(200)
    return { body }
  }

  @Post('intersection')
  intersection(@Body() body: IndexedItem): unknown {
    return body
  }

  @Post('nested')
  nested(@Body() body: { item: IndexedItem }): unknown {
    return body
  }

  @Post('array')
  array(@Body() body: IndexedItem[]): unknown {
    return body
  }

  @Post('union')
  union(@Body() body: Item | { enabled: boolean }): unknown {
    return body
  }

  @Get('query')
  query(@Query('filter') filter: string | number): unknown {
    return { filter }
  }
}
