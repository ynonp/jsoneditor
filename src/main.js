import JSONEditor from './components/JSONEditor.svelte'

export default function jsoneditor (config) {
	const { target, ...restConfig } = config
	
	return new JSONEditor({
		target,
		props: {
			config: restConfig
		}
	})
}

export { createAjvValidator } from './plugins/createAjvValidator.mjs'
