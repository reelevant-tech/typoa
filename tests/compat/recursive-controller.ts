import { Body, Controller, Post, Route } from './runtime'
import { received, selectItem } from './controllers'

interface Box<T> {
  value: T
  next?: T extends 1 ? undefined : Box<T>
}
interface Parent {
  box: Box<number>
}
interface Child extends Parent {
  box: Box<1>
}
interface RecursiveItem {
  next?: RecursiveItem
}
interface Item extends RecursiveItem {
  next?: undefined
  name: string
}

export function selectBox(req: { body: any }): string {
  selectItem({ body: { ...req.body, kind: 'text' } })
  return 'Child'
}

@Route('compat')
export class RecursiveController extends Controller {
  @Post('recursive-box')
  box(@Body() body: Child): unknown {
    received(body)
    return body
  }

  @Post('recursive-discriminated')
  discriminated(@Body('application/json', selectBox) body: unknown): unknown {
    received(body)
    return body
  }

  @Post('recursive-item')
  item(@Body() body: Item): unknown {
    received(body)
    return body
  }
}
