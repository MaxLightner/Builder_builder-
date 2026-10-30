// Reproducible, fail-closed source-level customization of pinned MIT OpenPlan3D.
// Run after cloning the pinned upstream commit and before npm build.
// This is NOT patching compiled minified output.
import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root)throw Error('Usage: node studio/integration/patch-openplan.mjs <upstream_dir>');
const abs=p=>path.join(root,p);
function read(p){return fs.readFileSync(abs(p),'utf8')}
function write(p,c){fs.mkdirSync(path.dirname(abs(p)),{recursive:true});fs.writeFileSync(abs(p),c)}
function replaceOne(input,needle,replacement,file){
  if(!input.includes(needle))throw Error('Upstream changed; expected anchor not found in '+file+': '+needle.slice(0,100));
  if(input.split(needle).length!==2)throw Error('Ambiguous upstream anchor in '+file);
  return input.replace(needle,replacement);
}
const editor='src/routes/editor/+page.svelte';
let code=read(editor);
code=replaceOne(code,
"  import TopBar from '$lib/components/toolbar/TopBar.svelte';",
"  import TopBar from '$lib/components/toolbar/TopBar.svelte';\n  import BuilderPanel from '$lib/components/editor/BuilderPanel.svelte';",editor);
const tag='<TopBar onToggleLayers={() => showLayers = !showLayers} layersOpen={showLayers} onToggleHistory={toggleHistory} historyOpen={showUndoHistory} />';
code=replaceOne(code,tag,tag+'\n    <BuilderPanel />',editor);
write(editor,code);
const home='src/routes/+page.svelte';
code=read(home);
const anchor='  onMount(() => {\n    void withLibraryError(async () => {';
code=replaceOne(code,anchor,
'  onMount(() => {\n    if (new URL(window.location.href).searchParams.get("builder") === "1") {\n      void goto(base + "/editor?builder=1");\n      return;\n    }\n    void withLibraryError(async () => {',home);
write(home,code);
write('src/lib/components/editor/BuilderPanel.svelte',fs.readFileSync('studio/integration/BuilderPanel.svelte','utf8'));
write('src/lib/builder/openplan-export.js',fs.readFileSync('studio/openplan-export.js','utf8'));
write('src/lib/builder/native-check.js',fs.readFileSync('studio/integration/native-check.js','utf8'));
console.log('Applied pinned source customizations: panel in editor, native project bridge, live checks, direct Studio navigation.');
