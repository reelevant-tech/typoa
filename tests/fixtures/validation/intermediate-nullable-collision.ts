import { Body, Controller, Post, Route } from '../../../src'

interface Box<T> {
  value: T
  next?: T extends 1 ? undefined : Box<T> | null
  sibling?: T extends 1 ? undefined : Box<T>
}

interface Parent {
  box: Box<number>
}

interface Child extends Parent {
  box: Box<1>
}

@Route('/nullable-collision')
export class NullableCollisionController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
