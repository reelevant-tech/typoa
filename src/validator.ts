import express from 'express'
import { OpenAPIV3 } from 'openapi-types'
import debug from 'debug'

const log = debug('toag:validator')

export class ValidateError extends Error {
  public status = 400
  public name = 'ValidateError'

  constructor (public fields: Record<string, { message: string; value?: any }>, public message: string) {
    super(message)
  }
}

export function validateAndParse (
  req: express.Request,
  schemas: OpenAPIV3.ComponentsObject['schemas'],
  rules: {
    params: OpenAPIV3.ParameterObject[]
    body: OpenAPIV3.RequestBodyObject
  }
): any[] {
  const args: any[] = []
  for (const param of (rules.params || [])) {
    // Handling @Request()
    if (param.in === 'request') {
      args.push(req)
      continue
    }
    // Handling body
    if (param.in === 'body') {
      args.push(validateBody(req, rules.body, schemas))
      continue
    }
    // Handling other params: header, query and path
    let value: string | undefined | string[]
    switch (param.in) {
      case 'header':
        value = req.headers[param.name]
        break
      case 'query':
        value = req.query[param.name] as string | undefined | string[]
        break
      case 'path':
        value = req.params[param.name]
        break
    }
    if (param.required === true && (typeof value === 'undefined' || value.length === 0)) {
      throw new ValidateError({
        [param.name]: { message: 'Param is required', value }
      }, 'Missing parameter')
    }
    args.push(validateAndParseValueAgainstSchema(param.name, value, param.schema!, schemas))
  }
  return []
}

function validateBody (// TODO: discriminator validation
  req: express.Request,
  rule: OpenAPIV3.RequestBodyObject,
  schemas: OpenAPIV3.ComponentsObject['schemas']
): any {
  const body = req.body
  const contentType = req.headers['content-type'] ?? 'application/json'
  const expectedSchema = rule.content[contentType]?.schema
  if (typeof expectedSchema === 'undefined') {
    log(`! Warning: body validation skipped, schema is not found for '${contentType}' !`)
    return {}
  }
  return validateAndParseValueAgainstSchema('body', body, expectedSchema, schemas)
}

function getFromRef (
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject,
  schemas: OpenAPIV3.ComponentsObject['schemas']
): OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject {
  if ('$ref' in schema) {
    return getFromRef(schemas![schema.$ref.substr('#/components/schemas/'.length)], schemas)
  }
  return schema
}

function validateAndParseValueAgainstSchema (
  name: string,
  value: unknown,
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject,
  schemas: OpenAPIV3.ComponentsObject['schemas']
): unknown {
  const currentSchema = getFromRef(schema, schemas)
  // Nullable
  if (value === null) {
    if (currentSchema.nullable) {
      return null
    }
    throw new ValidateError({
      [name]: { message: 'This property is not nullable' }
    }, 'Invalid parameter')
  }
  // Strings
  if (currentSchema.type === 'string') {
    if (typeof value !== 'string') {
      throw new ValidateError({
        [name]: { message: 'This property must be a string', value }
      }, 'Invalid parameter')
    }
    let parsedValue = value
    if (currentSchema.enum && currentSchema.enum.includes(value) === false) {
      throw new ValidateError({
        [name]: { message: `This property must be one of ${currentSchema.enum}`, value }
      }, 'Invalid parameter')
    }
    if (currentSchema.pattern) {
      parsedValue = validateAndParsePattern(name, parsedValue, currentSchema.pattern)
    }
    if (currentSchema.format) {
      return validateAndParseFormat(name, parsedValue, currentSchema.format)
    }
    return parsedValue
  }
  // Numbers
  if (currentSchema.type === 'number') {
    const parsedValue = parseFloat(String(value))
    if (isNaN(parsedValue)) {
      throw new ValidateError({
        [name]: { message: 'This property must be a number', value }
      }, 'Invalid parameter')
    }
    if (currentSchema.minimum) {
      if (parsedValue < currentSchema.minimum) {
        throw new ValidateError({
          [name]: { message: `This property must be >= ${currentSchema.minimum}`, value }
        }, 'Invalid parameter')
      }
    }
    if (currentSchema.maximum) {
      if (parsedValue > currentSchema.maximum) {
        throw new ValidateError({
          [name]: { message: `This property must be <= ${currentSchema.maximum}`, value }
        }, 'Invalid parameter')
      }
    }
    if (currentSchema.enum && currentSchema.enum.includes(parsedValue) === false) {
      throw new ValidateError({
        [name]: { message: `This property must be one of ${currentSchema.enum}`, value }
      }, 'Invalid parameter')
    }
    return parsedValue
  }
  // Boolean
  if (currentSchema.type === 'boolean') {
    const parsedValue = String(value)
    if (parsedValue !== '1' && parsedValue !== '2' && parsedValue !== 'true' && parsedValue !== 'false') {
      throw new ValidateError({
        [name]: { message: 'This property must be a boolean', value }
      }, 'Invalid parameter')
    }
    return parsedValue === '1' || parsedValue === 'true'
  }
  // Array
  if (currentSchema.type === 'array') {
    if (!Array.isArray(value)) {
      throw new ValidateError({
        [name]: { message: 'This property must be an array', value }
      }, 'Invalid parameter')
    }
    return value.map((item, i) => {
      return validateAndParseValueAgainstSchema(`${name}.${i}`, item, currentSchema.items, schemas)
    })
  }
  // Object
  if (currentSchema.type === 'object') {
    if (typeof value !== 'object') {
      throw new ValidateError({
        [name]: { message: 'This property must be an object', value }
      }, 'Invalid parameter')
    }
    return Object.keys(currentSchema.properties || {})
      .filter((propName) => { // Ignore readOnly properties
        const val = currentSchema.properties![propName]
        return !('readOnly' in val) || val.readOnly !== true
      })
      .reduce((props, propName) => {
        const propValue = (value as Record<string, unknown>)[propName]
        const isNotDefined = typeof propValue === 'undefined' || (typeof propValue === 'string' && propValue.length === 0)
        if (currentSchema.required?.includes(propName) && isNotDefined === false) {
          throw new ValidateError({
            [`${name}.${propName}`]: { message: 'This property is required', value }
          }, 'Invalid parameter')
        }
        props[propName] = validateAndParseValueAgainstSchema(
          `${name}.${propName}`,
          propValue,
          currentSchema.properties![propName],
          schemas
        )
        return props
      }, {} as Record<string, unknown>)
  }
  // AllOf
  if (currentSchema.allOf) {
    // try to validate every allOf and merge their results
    return Object.assign({}, ...currentSchema.allOf.map((schema, i) => {
      validateAndParseValueAgainstSchema(
        `${name}.${i}`,
        value,
        schema,
        schemas
      )
    }))
  }
  // OneOf
  if (currentSchema.oneOf) {
    let matchingValue: unknown | undefined
    currentSchema.oneOf.forEach((schema, i) => {
      try {
        matchingValue = validateAndParseValueAgainstSchema(
          `${name}.${i}`,
          value,
          schema,
          schemas
        )
      } catch {
        // noop, try another schema
      }
    })
    if (typeof matchingValue === 'undefined') {
      throw new ValidateError({
        [name]: { message: 'Found no matching schema for provided value', value }
      }, 'Invalid parameter')
    }
    return matchingValue
  }
  log(`Schema of ${name} is not yet supported, ignoring value`)
  return undefined // ignored
}

function validateAndParseFormat (name: string, value: string, format: string) {
  if (format === 'date' || format === 'date-format') {
    const date = new Date(value)
    if (String(date) === 'Invalid Date') {
      throw new ValidateError({
        [name]: { message: 'This property must be a valid date', value }
      }, 'Invalid parameter')
    }
    return date
  }
  log(`Format '${format}' is not yet supported, value is returned without additionnal parsing`)
  return value
}

function validateAndParsePattern (name: string, value: string, pattern: string) {
  const regex = new RegExp(pattern)
  if (!regex.test(value)) {
    throw new ValidateError({
      [name]: { message: `This property must match the pattern: ${regex}`, value }
    }, 'Invalid parameter')
  }
  return value
}
