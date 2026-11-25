import { Body, Controller, Post, Route } from '../../../src'

interface Base {
  id: string
}

interface Item extends Base {
  name: string
}

interface RecursiveItem {
  value: number
  next?: RecursiveItem
}

type RecursiveValue = string | RecursiveValue[]
type RecursiveMapping = { [K in 'next']?: RecursiveMapping }

@Route('/items')
export class RecursiveOrderController extends Controller {
  @Post('/item')
  create(@Body() body: Item): Item {
    return body
  }

  @Post('/recursive')
  append(@Body() body: RecursiveItem): RecursiveItem {
    return body
  }

  @Post('/value')
  value(@Body() body: RecursiveValue): RecursiveValue {
    return body
  }

  @Post('/mapping')
  mapping(@Body() body: RecursiveMapping): RecursiveMapping {
    return body
  }
}
