import { Body, Controller, Post, Route } from '../../../src'

interface Item {
  id: string
  count: number
}

interface Base<T> {
  data: Partial<T>
}

interface Envelope<T> extends Base<T> {
  code: number
}

interface Result extends Envelope<Item> {
  active: boolean
}

@Route('/partial')
export class PartialController extends Controller {
  @Post()
  create(@Body() body: Result): Result {
    return body
  }
}
