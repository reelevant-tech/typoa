<div align="center">

  <h1>typoa</h1>
  <h2> <b>Typ</b>escript <b>O</b>pen<b>A</b>PI Generator</h2>

This tools is inspired from [tsoa](https://github.com/lukeautry/tsoa), the purpose is to be able to generate openapi definitions and express routes definitions via Typescript typings.

We're using [ts-morph](https://github.com/dsherret/ts-morph) under the hood.

</div>

## Why

Tsoa is a great package and it's working fine for simple typescript typings, which I think are principal use cases, it's used by many developers and maintained.

**BUT**, I've used tsoa in production projects and I've encountered many issues (I was able to [fix](https://github.com/lukeautry/tsoa/pulls?q=is%3Apr+sort%3Aupdated-desc+is%3Amerged+author%3AEywek) some of them), but when I've tried to use more complex types (inheritance, deep generics, conditionnal types...) tsoa wasn't able to provide me good openapi definitions, and without even telling me it failed to generate the right schema.

I've spent a lot of time trying to fix those issues, using tricks to have a workaround. But it was never perfect, I've ended with too many duplicated types only because tsoa was not able to resolve correct typings. I wasn't confident when updating my models and I was always checking that the swagger wasn't broken.

And all of this issues are caused by the custom type resolver of tsoa, in this package we're using `ts-morph`, it allows us to build a resolver more resilient that handle all cases without maintenance on our side.

## Features

- Generate express router via typescript decorators in controllers
- Generate openapi definition via typescript typings
- Allowing to export custom types to openapi schema
- Runtime validation against openapi schema
- Use jsdoc for additionnal configuration (example, regex...)
- Handle getters only and readonly properties

## How to use

### Additional component schemas

`openapi.additionalExportedTypeNames` lists additional exported TypeScript types
to include in `components.schemas`, even when no operation uses them.

By default, `openapi.keepIntermediateSchemas` also keeps named bases, generic
instantiations and Omit/Pick members encountered while flattening inherited and
intersection types. Their component names are retained for generated-client
imports, but their contents use the current flattened schemas, not closed-object
`allOf` composition. Existing operation schemas and generated routers are unchanged.
Set `openapi.keepIntermediateSchemas: false` to emit only the components otherwise
needed by operations and `additionalExportedTypeNames`.

### Define your controllers

You only need to add the `@Route()` decorator at the top of your controller class and `@Get()`, `@Post()`... at the top
of each method definition, like this:

```ts
import { Route, Get } from 'typoa/runtime'

@Route()
class MyController {
  @Get()
  public get() {}
}
```

You can provide the route path in the `@Route()` decorator or in each verb decorators (eg. `@Get`...) or both.

You also will need to extends the `Controller` class if you want to override the default HTTP status (200 if your method return content, 204 if not):

```ts
import { Route, Get, Controller } from 'typoa/runtime'

@Route('/controller-path')
class MyController extends Controller {
  @Get('/method-path')
  public get() {
    this.setStatus(201)
    return 'Created'
  }
}
```

To send data to the client you only need to return your data, `typoa` will use `res.json()` with it.
If you return a stream, `typoa` will stream it to the client.

#### Body, Query, Path, Header and Request

To use the parsed (and validated) body from typoa you only need to provide the `@Body()` decorator:

```ts
import { Route, Get, Controller } from 'typoa/runtime'

@Route('/controller-path')
class MyController extends Controller {
  @Post('/method-path')
  public post(@Body() body: { name: string }) {
    this.setStatus(201)
    return 'Created'
  }
}
```

This is the same for query parameters (`@Query('<name>')`), path parameters (`@Path('<name>')`) and headers (`@Header('<name>')`).

You also can use the `@Request()` decorator if you need to access the express request.

**Note:** You can see more examples in the `example/` folder.

##### Body discrimination

Sometimes you want to validate the body against a specific schema depending on which resource the user try to update...

To handle that, you can provide a `discriminator function` to the body decorator:

```ts
import {
  Route,
  Get,
  Controller,
  BodyDiscriminatorFunction
} from 'typoa/runtime'

type TypeA = { name: string }
type TypeB = { name: number }

// The function need to return the name of the type you want to validate against
export const discriminatorFunction: BodyDiscriminatorFunction = async req =>
  'TypeA'

@Route('/controller-path')
class MyController extends Controller {
  @Post('/method-path')
  public post(
    @Body(
      'application/json', // body content-type
      discriminatorFunction // name of the function you want to use
    )
    body: TypeA | TypeB
  ) {
    this.setStatus(201)
    return 'Created'
  }
}
```

### Generate

To generate the openapi definition and the router you will need to bind to express, you only need to call the `generate` method of `typoa`:

```ts
import { generate } from 'typoa'

await generate({
  tsconfigFilePath: path.resolve(__dirname, './tsconfig.json'),
  controllers: [path.resolve(__dirname, './*.ts')], // Path of your controllers
  openapi: {
    // Where do you want to generate your openapi file (or array of file paths)
    // The file extension (.json, .yaml, or .yml) determines the output format
    filePath: '/tmp/openapi.json',
    service: {
      // Used in the openapi definitions
      name: 'my-service',
      version: '1.0.0'
    },
    securitySchemes: {
      // Openapi securitySchemes definitions
      company: {
        type: 'apiKey',
        name: 'x-company-id',
        in: 'header'
      }
    },
    // Optional, fail on a misspelled JSDoc tag (e.g. @minLenght) instead of a logger warning
    strictJsDocTags: true
  },
  router: {
    filePath: './router.ts', // Where do you want to generate the router file
    securityMiddlewarePath: './security.ts' // Optional, middleware called if you use the @Security() decorator
  }
})
```

### Runtime imports

`typoa` is the generator entry point and loads `ts-morph` (the TypeScript compiler), which costs tens of MiB of memory.
Code that runs in your service (controllers, decorators, `Controller`, `setRuntimeOptions`...) should import from `typoa/runtime` instead, which never loads it:

```ts
import { Route, Get, Controller, setRuntimeOptions } from 'typoa/runtime'
```

Keep `import { generate } from 'typoa'` in your generation script only.
The generated router imports from `typoa/runtime` by default (override with `router.runtimeImport`).

OpenAPI generation preserves alpha.71 composition, component names and metadata.
If alpha.71 schema resolution overflows on recursive types, the entire document
is regenerated with cycle-safe flattened schemas. `openapi.keepIntermediateSchemas`
remains accepted: it does not change alpha.71-compatible documents, and controls
additional intermediate schemas in cycle-safe documents (default `true`).

### Compatibility checks

`yarn compat` runs the generic controllers in `tests/compat` through generated
routers on a real listening HTTP server. It compares status, JSON payload and
controller arguments (including explicit undefined/Date markers) with committed
Express-major snapshots, and checks the complete OpenAPI document. It also runs
oatyp alpha.33 and `tsc --noEmit` on `type-usage.ts`. These tests are included in
`yarn test`; no network access is needed for the snapshot/client checks.

Review intentional changes before running
`UPDATE_COMPAT_SNAPSHOTS=1 yarn compat`. Run this once with Express 4 installed
and once with Express 5; the OpenAPI snapshot is shared. Missing snapshots fail
without this flag. The snapshots characterize existing behavior, including
limitations such as omitted falsy defaults; they are not an endorsement of it.

`yarn compat:release` installs **`typoa@latest` from npm** in a disposable directory
with lifecycle scripts disabled, generates the same fixtures with both versions,
and compares the complete OpenAPI document and every HTTP result. All differences
fail unless explicitly listed in `tests/compat/accepted-changes.json` with
`caseId`, `expressMajor`, `reason`, `sinceVersion`, and exact `before`/`after`
SHA-256 digests printed by the comparison. `openapi` identifies the main document;
`recursive.openapi`, `compositional.openapi` and `nonrecursive.openapi` identify
the other fixture documents; other IDs identify HTTP cases. Use the next
intended release for `sinceVersion`.
Duplicate IDs across HTTP fixture groups and documents fail before comparison.
Exceptions fail if they disappear or their digests change, and **all entries
whose sinceVersion is at or below npm latest fail as stale**, even for another
Express major. Remove them after publication; do not extend their expiry to
silence a failure. There is no automatic exception-update command.

`yarn compat:legacy` independently installs published alpha.71 and checks
all HTTP cases except the separate regex-path controller and the recursive
fixtures that alpha.71 cannot generate, including all compositional cases.
It also compares the main, compositional and nonrecursive OpenAPI documents
byte-for-byte with alpha.71.
The default `yarn test` and `yarn compat` check the compositional HTTP snapshots
offline; only `yarn compat:legacy` installs alpha.71 for a live comparison.
The regex-path controller is separate because
alpha.71 cannot register its Express 4 route syntax on Express 5.

Nonrecursive override controls also use alpha.71. Recursive compositional schema
graphs cannot be generated by alpha.71, so those request values are parsed with
the flattened rules instead; their HTTP snapshots and live `compat:release`
comparison preserve alpha.82 behavior. Acyclic composition remains authoritative.

CI runs all three commands on Express 4.17.1, 4.22.3 and 5.3.0. The quality
workflow runs the matrix on PRs to any branch, including stacked PRs. On main, the serialized publish workflow runs
it after tests/lint and requires it before bumping the version or publishing.
This prevents our own publication from changing npm latest during comparison;
stale exceptions still fail after a release. When adding a
regression case, add a stable ID and controller, inspect/update the snapshots on
both majors, extend `type-usage.ts` where relevant, and explicitly review any
new release exceptions.
