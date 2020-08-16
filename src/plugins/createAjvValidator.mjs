import Ajv from 'ajv'
import { parseJSONPointer } from '../utils/jsonPointer.js'
import { draft04 } from '../generated/ajv/draft04.mjs'
import { draft06 } from '../generated/ajv/draft06.mjs'

/**
 * Create a JSON Schema validator powered by Ajv.
 * @param {JSON} schema 
 * @param {Object} [schemaRefs=undefined]  An object containing JSON Schema references
 * @return {function (doc: JSON) : Array<Object>} Returns a valiation function
 */
export function createAjvValidator (schema, schemaRefs) {
  const ajv = Ajv({
    allErrors: true,
    verbose: true,
    schemaId: 'auto',
    jsonPointers: true,
    $data: true
  })

  // support both draft-04 and draft-06 alongside the latest draft-07
  ajv.addMetaSchema(draft04) // FIXME
  ajv.addMetaSchema(draft06) // FIXME

  if (schemaRefs) {
    Object.keys(schemaRefs).forEach(ref => {
      ajv.addSchema(schemaRefs[ref], ref)
    })
  }

  const validateAjv = ajv.compile(schema)

  return function validate (doc) {
    validateAjv(doc)
    const ajvErrors = validateAjv.errors 

    return ajvErrors
      .map(improveAjvError)
      .map(normalizeAjvError)
  }
}

/**
 * @param {Object} ajvError
 * @return {ValidationError} 
 */
function normalizeAjvError (ajvError) {
  return {
    path: parseJSONPointer(ajvError.dataPath),
    message: ajvError.message 
  }
}

/**
 * Improve the error message of a JSON schema error, 
 * for example list the available values of an enum.
 * 
 * @param {Object} ajvError
 * @return {Object} Returns the error with improved message
 */
function improveAjvError (ajvError) {
  if (ajvError.keyword === 'enum' && Array.isArray(ajvError.schema)) {
    let enums = ajvError.schema
    if (enums) {
      enums = enums.map(value => JSON.stringify(value))

      if (enums.length > 5) {
        const more = ['(' + (enums.length - 5) + ' more...)']
        enums = enums.slice(0, 5)
        enums.push(more)
      }
      ajvError.message = 'should be equal to one of: ' + enums.join(', ')
    }
  }

  if (ajvError.keyword === 'additionalProperties') {
    ajvError.message = 'should NOT have additional property: ' + ajvError.params.additionalProperty
  }

  return ajvError
}
