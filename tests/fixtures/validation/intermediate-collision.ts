import { Body, Controller, Post, Route } from '../../../src'

interface Box<T> {
  value: T
}

interface Parent {
  /** @description Primary box */
  box: Box<number>
  other?: Box<number>
}

interface Child extends Parent {
  box: Box<1>
}

@Route('/collision')
export class CollisionController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
