import { Body, Controller, Post, Route } from './runtime'
import { received } from './controllers'

interface Box<T> {
  value: T
}
interface Parent {
  box: Box<number>
}
interface Child extends Parent {
  box: Box<1>
}
interface Base {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  next?: {}
}
interface Item extends Base {
  next?: undefined
  name: string
}

/** @additionalproperties true */
interface Open {
  name: string
}
/** @additionalproperties false */
interface Closed {
  name: string
}
interface Pair extends Open, Closed {}

@Route('compat')
export class NonrecursiveController extends Controller {
  @Post('nonrecursive-strict')
  strict(@Body() body: Pair): unknown {
    received(body)
    return body
  }

  @Post('nonrecursive-box')
  box(@Body() body: Child): unknown {
    received(body)
    return body
  }

  @Post('nonrecursive-item')
  item(@Body() body: Item): unknown {
    received(body)
    return body
  }
}
