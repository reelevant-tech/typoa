import { Body, Controller, Post, Route } from '../../../src'

export enum NullableParsingMode {
  First = 'first',
  True = 'true',
  Zero = '0'
}

interface RecursiveNode<T> {
  value: T
  next?: T extends 1 ? undefined : RecursiveNode<T>
}

interface ParsedValue {
  count: number
  flag: boolean
}

interface ParentEnvelope {
  node: RecursiveNode<number>
}

interface PlainEnvelope extends ParentEnvelope {
  node: RecursiveNode<1>
  mode: NullableParsingMode
  value: ParsedValue
}

interface NullableEnvelope extends ParentEnvelope {
  node: RecursiveNode<1>
  mode: NullableParsingMode | null
  value: ParsedValue | null
}

@Route('/nullable-parsing')
export class NullableParsingController extends Controller {
  @Post('/plain')
  plain(@Body() body: PlainEnvelope): PlainEnvelope {
    return body
  }

  @Post('/nullable')
  nullable(@Body() body: NullableEnvelope): NullableEnvelope {
    return body
  }
}
