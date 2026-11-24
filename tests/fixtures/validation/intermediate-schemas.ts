import { Body, Controller, Post, Route } from '../../../src'

interface Item {
  name: string
  ignored?: boolean
}

interface Tagged {
  tags: string[]
}

type Serialize<T> = { [K in keyof T]: T[K] }

interface Detail extends Omit<Item, 'ignored'>, Pick<Tagged, 'tags'> {
  count: number
}

interface Serialized extends Serialize<Detail> {
  id: string
}

interface Container<T> {
  data: T
}

interface InternalResponse<T> extends Container<T> {
  code: number
}

interface Nested extends InternalResponse<Container<Item>> {
  active: boolean
}

type Payload = Omit<Item, 'ignored'> & Pick<Tagged, 'tags'>

@Route('/intermediates')
export class IntermediateController extends Controller {
  @Post('/serialized')
  serialized(@Body() body: Serialized): Serialized {
    return body
  }

  @Post('/nested')
  nested(@Body() body: Nested): Nested {
    return body
  }

  @Post('/intersection')
  intersection(@Body() body: Payload): Payload {
    return body
  }
}
