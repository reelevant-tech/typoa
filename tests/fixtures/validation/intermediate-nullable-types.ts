import { Body, Controller, Post, Route } from '../../../src'

enum Kind {
  First = 'first',
  Second = 'second'
}

interface Item {
  id: string
}

interface ObjectValue {
  toJSON(): Item
}

interface ScalarValue {
  toJSON(): string
}

interface ArrayValue {
  toJSON(): string[]
}

interface Parent {
  kind: Kind | null
  object: ObjectValue | null
  scalar: ScalarValue | null
  list: ArrayValue | null
}

interface Child extends Parent {
  kind: Kind.First
  object: ObjectValue
  scalar: ScalarValue
  list: ArrayValue
}

@Route('/nullable-types')
export class NullableTypesController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
