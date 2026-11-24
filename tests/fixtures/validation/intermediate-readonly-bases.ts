import { Body, Controller, Post, Route } from '../../../src'

interface Box<T> {
  value: T
  readonly next?: T extends 1 ? undefined : Box<T>
}

interface Parent {
  readonly box: Box<number>
}

interface Tagged {
  tags: string[]
}

interface Combined extends Parent, Tagged {}

interface Child extends Combined {
  box: Box<1>
}

@Route('/readonly-bases')
export class ReadonlyBasesController extends Controller {
  @Post()
  create(@Body() body: Child): Child {
    return body
  }
}
