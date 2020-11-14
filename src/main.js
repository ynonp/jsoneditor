import Main from './components/Main.svelte'

export default function jsoneditor (config) {
	const { target, ...restConfig } = config
	
	return new Main({
		target,
		props: {
			config: restConfig
		}
	})
}

// plugins
export { createAjvValidator } from './plugins/createAjvValidator.mjs'
