import { Body, Controller, Post, Route } from '../../../src'

interface RecursiveItem {
  next?: RecursiveItem
}

interface Item extends RecursiveItem {
  next?: undefined
  name: string
}

@Route('items')
export class ItemController extends Controller {
  @Post()
  create(@Body() item: Item): Item {
    return item
  }
}
