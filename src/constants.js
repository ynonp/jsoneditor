
export const STATE_EXPANDED = Symbol('expanded')
export const STATE_LIMIT = Symbol('limit')
export const STATE_PROPS = Symbol('props')
export const STATE_SEARCH_PROPERTY = Symbol('search:property')
export const STATE_SEARCH_VALUE = Symbol('search:value')
export const VALIDATION_ERROR = Symbol('validation:error')

export const SCROLL_DURATION = 300 // ms
export const DEBOUNCE_DELAY = 300
export const SEARCH_PROGRESS_THROTTLE = 300 // ms
export const MAX_SEARCH_RESULTS = 1000
export const DEFAULT_LIMIT = 100
export const MAX_PREVIEW_CHARACTERS = 20e3 // characters

export const INDENTATION_WIDTH = 18 // pixels IMPORTANT: keep in sync with sass constant $indentation-width

export const SIMPLE_MODAL_OPTIONS = {
  closeButton: false,
  styleBg: {
    top: 0,
    left: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'normal'
  },
  styleWindow: {
    borderRadius: '2px'
  },
  styleContent: {
    padding: '0px',
    overflow: 'visible' // needed for select box dropdowns which are larger than the modal
  }
}
