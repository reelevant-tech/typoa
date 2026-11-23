import { Body, Controller, Post, Route } from '../../../src'

export enum Kind {
  A = 'a',
  B = 'b'
}

type Serialized<T> = { [K in keyof T]: T[K] }
interface Item {
  tags: Kind.A[]
}

export interface ClientValue {
  kind: Kind
  readonly tags: (Kind.A[] & Kind[]) | (Kind.B[] & Kind[])
  serialized: Serialized<Item> & { tags: Kind[] }
}

@Route('array-client')
export class ArrayClientController extends Controller {
  @Post()
  public create(@Body() body: ClientValue): ClientValue {
    return body
  }
}
