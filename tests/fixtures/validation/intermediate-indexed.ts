import { Body, Controller, Post, Route } from '../../../src'

interface Item {
  id: string
  count: number
}

interface Selection<T extends { id: string }> {
  key: keyof T
  id: T['id']
}

interface Envelope<T extends { id: string }> extends Selection<T> {
  data: T
}

interface Selected extends Envelope<Item> {
  active: boolean
}

@Route('/indexed')
export class IndexedController extends Controller {
  @Post()
  create(@Body() body: Selected): Selected {
    return body
  }
}
