import { Body, Controller, Post, Route } from '../../../src'

interface Item {
  toJSON(): { id: string; count: number }
}

interface Base<T extends { toJSON(): { id: string; count: number } }> {
  data: Partial<T>
}

interface Envelope<T extends Item> extends Base<T> {
  code: number
}

interface Child extends Envelope<Item> {
  active: boolean
}

@Route('/partial-literal')
export class PartialLiteralController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
