import { Body, Controller, Post, Route } from '../../../src'

interface Serializable {
  toJSON(): { id: string; count: number }
}

interface Item extends Serializable {
  tag?: string
}

interface Base<T extends Serializable> {
  data: Partial<T>
}

interface Envelope<T extends Serializable> extends Base<T> {
  code: number
}

interface Child extends Envelope<Item> {
  active: boolean
}

@Route('/partial-serialized')
export class PartialSerializedController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
