import JSONEditor from './components/JSONEditor.svelte'
import _TreeMode from './components/treemode/TreeMode.svelte'

export default function jsoneditor (config) {
	const { target, ...restConfig } = config
	
	return new JSONEditor({
		target,
		props: {
			config: restConfig
		}
	})
}

export const TreeMode = _TreeMode

export { createAjvValidator } from './plugins/createAjvValidator.mjs'
