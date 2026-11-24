import { Body, Controller, Post, Route } from '../../../src'

interface Box<T> {
  value: T
}

enum Box_Intermediate {
  First = 'first',
  Second = 'second'
}

interface Parent {
  box: Box<number>
  kind: Box_Intermediate
}

interface Child extends Parent {
  box: Box<1>
  kind: Box_Intermediate.First
}

@Route('/reserved-enum')
export class ReservedEnumController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
