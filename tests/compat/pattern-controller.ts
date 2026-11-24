import { Controller, Get, Header, Path, Route } from './runtime'
import { received } from './controllers'

@Route('compat')
export class PatternController extends Controller {
  @Get('path/{id([0-9]+)}')
  path(@Path('id') id: number, @Header('x-enabled') enabled: boolean): unknown {
    received(id, enabled)
    return { id, enabled }
  }
}
