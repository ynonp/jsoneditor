// load Ace editor
import ace from 'ace-builds/src-noconflict/ace'

// load required Ace plugins
import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/ext-searchbox'

// embed Ace json worker
// generated via tools/generateWorkerJSONDataUrl.mjs
// https://github.com/ajaxorg/ace/issues/3913
import jsonWorkerDataUrl from '../generated/worker-json-data-url'
ace.config.setModuleUrl('ace/mode/json_worker', jsonWorkerDataUrl)

export const aceJson = ace
