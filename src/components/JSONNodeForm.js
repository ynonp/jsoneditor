// @flow

import JSONNode from './JSONNode'

import type { PropertyData, JSONData } from '../types'

/**
 * JSONNodeForm
 *
 * Creates JSONNodes without action menus and with readonly properties
 */
export default class JSONNodeForm extends JSONNode {

  // render no action menu...
  renderActionMenuButton () {
    return null
  }

  // render no append menu...
  renderAppendMenuButton () {
    return null
  }

  // render a readonly property
  renderProperty (prop: ?PropertyData, index: ?number, data: JSONData, options: {escapeUnicode: boolean, isPropertyEditable: (Path) => boolean}) {
    const formOptions = Object.assign({}, options, { isPropertyEditable })

    return JSONNode.prototype.renderProperty.call(this, prop, index, data, formOptions)
  }
}

function isPropertyEditable () {
  return false
}