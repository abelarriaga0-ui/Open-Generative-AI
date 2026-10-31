import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Crear video starts a fresh project and never auto-opens the previous Premium research',()=>{
 const premium=readFileSync('components/RealizoPremium.jsx','utf8');
 const studio=readFileSync('components/RealizoStudio.jsx','utf8');
 assert.doesNotMatch(premium,/const latest=v\.projects\?\.\[0\]/);
 assert.doesNotMatch(premium,/setProject\(await response\.json\(\)\);[\s\S]*?latest/);
 assert.match(premium,/if\(initialProjectId\)/);
 assert.match(premium,/onCreateNew/);
 assert.match(studio,/nav\('create','Crear video','video',startNewVideo\)/);
 assert.match(studio,/setResumeProjectId\(null\)/);
 assert.match(studio,/setCreateKey\(current=>current\+1\)/);
 assert.match(studio,/key=\{'premium-'\+createKey/);
});
test('Mis videos holds the real completed videos and a separate recoverable research history',()=>{
 const studio=readFileSync('components/RealizoStudio.jsx','utf8');
 const jobs=readFileSync('app/api/realizo/jobs/route.js','utf8');
 assert.match(studio,/\/api\/realizo\/jobs/);
 assert.match(studio,/\/api\/realizo\/ai-premium/);
 assert.match(studio,/Proyectos Premium guardados/);
 assert.match(studio,/reopenPremiumProject\(item\.id\)/);
 assert.match(studio,/video_url/);
 assert.match(jobs,/FROM generation_jobs WHERE user_id=\?/);
 assert.match(studio,/Promise\.allSettled/);
});
test('New project resets only UI state, not balance or saved research',()=>{
 const studio=readFileSync('components/RealizoStudio.jsx','utf8');
 const premium=readFileSync('components/RealizoPremium.jsx','utf8');
 const reset=studio.split('function startNewVideo(){')[1].split('function newPremiumProject(){')[0];
 assert.match(reset,/setBrief\(null\)/);
 assert.match(reset,/setEditorOpen\(false\)/);
 assert.doesNotMatch(reset,/fetch|DELETE|\/api\/wallet/);
 assert.match(premium,/\['created','researching'\]/);
});
