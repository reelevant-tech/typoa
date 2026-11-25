import { Body, Controller, Post, Route } from '../../../src'

namespace Operations {
  export interface Entry {
    label: string
  }

  export interface Left {
    label: string
  }

  export interface Right {
    label: string
  }
}

export type Entry = number
export type Left = number
export type Right = number

@Route('/exports')
export class ExportCollisionController extends Controller {
  @Post('/entry')
  entry(@Body() body: Operations.Entry): Operations.Entry {
    return body
  }

  @Post('/left')
  left(@Body() body: Operations.Left): Operations.Left {
    return body
  }

  @Post('/right')
  right(@Body() body: Operations.Right): Operations.Right {
    return body
  }
}
