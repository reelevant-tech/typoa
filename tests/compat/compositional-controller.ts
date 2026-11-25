import { Body, Controller, Post, Route } from './runtime'
import { received, selectItem } from './controllers'

interface Base {
  /** @readonly */
  stamp?: Date
}

interface Part {
  stamp?: Date
  tags?: {
    kinds?: Record<string, { required: boolean }>
  } & Record<string, unknown>
}

export type PatchItem = Partial<Base> & Partial<Part>

interface Item {
  name: string
}

interface Child extends Omit<Item, never> {
  count: number
}

type PatchList = Partial<{ items: Item[] }> & {
  items?: { name: string; tags: string[] }[]
}

export function selectPatchItem(req: { body: any }): string {
  selectItem({ body: { ...req.body, kind: 'text' } })
  return 'PatchItem'
}

@Route('compat')
export class CompositionalController extends Controller {
  @Post('compositional-inherited')
  inherited(@Body() body: Child): unknown {
    received(body)
    return body
  }

  @Post('compositional-array')
  arrays(@Body() body: PatchList): unknown {
    received(body)
    return body
  }

  @Post('compositional')
  update(@Body() body: PatchItem): unknown {
    received(body)
    return body
  }

  @Post('compositional-discriminated')
  discriminated(
    @Body('application/json', selectPatchItem) body: PatchItem
  ): unknown {
    received(body)
    return body
  }
}
