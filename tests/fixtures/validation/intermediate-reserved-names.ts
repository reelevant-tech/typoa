import { Body, Controller, Post, Route } from '../../../src'

interface Box<T> {
  value: T
}

interface Box_Intermediate {
  tags: string[]
}

interface Parent extends Box_Intermediate {
  box: Box<number>
}

interface Child extends Parent {
  box: Box<1>
}

@Route('/reserved-names')
export class ReservedNamesController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
