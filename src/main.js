import Main from './components/Main.svelte'

export default function jsoneditor (target, config) {
  return new Main({
    target,
    props: config
  })
}

// plugins
export { createAjvValidator } from './plugins/createAjvValidator.js'
