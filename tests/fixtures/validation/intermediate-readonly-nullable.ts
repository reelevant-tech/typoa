import { Body, Controller, Post, Route } from '../../../src'

interface Item {
  id: string
}

interface Parent {
  readonly data: Item | null
}

interface Tagged {
  tags: string[]
}

interface Combined extends Parent, Tagged {}

interface Child extends Combined {
  data: Item
}

@Route('/readonly-nullable')
export class ReadonlyNullableController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
