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

interface Chain {
  value: number
  next: Chain | undefined
}

interface Holder {
  root: Chain | undefined
}

type RecursiveValue = string | RecursiveValue[]
type RecursiveMapping = { [K in 'next']?: RecursiveMapping }
type Nested = Nested[] | null

interface NestedHolder {
  root?: Nested
  sibling?: NonNullable<Nested>
  model?: Value_Recursive_Nullable
  plainModel?: Value_Recursive
  kind?: Value_Recursive_Nullable_Intermediate
}

export interface Value_Recursive_Nullable {
  label: string
}

export interface Value_Recursive {
  name: string
}

export enum Value_Recursive_Nullable_Intermediate {
  First = 'first',
  Second = 'second'
}

export type Value_Recursive_Nullable_Intermediate_Intermediate = number
export type AnyValue = number

interface WildcardHolder {
  value: unknown
  other: any
}

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

  @Post('/optional')
  optional(@Body() body: Holder): Holder {
    return body
  }

  @Post('/nested')
  nested(@Body() body: NestedHolder): NestedHolder {
    return body
  }

  @Post('/wildcard')
  wildcard(@Body() body: WildcardHolder): WildcardHolder {
    return body
  }
}
