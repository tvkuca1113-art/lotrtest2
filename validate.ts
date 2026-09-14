import {STAGES} from '../src/content/stages';
import {RINGS} from '../src/content/rings';
import {makeMap,reachable} from '../src/world/maps';
import {writeFileSync} from 'node:fs';
const rows=STAGES.flatMap(s=>['Spring','Summer','Autumn','Winter'].map(season=>{const m=makeMap(s,season as any);return {stage:s.id,name:s.name,boss:s.boss,season,objectives:m.objectives.length,phases:s.attacks.length,patterns:s.attacks.flat(),reachable:[...m.objectives,m.checkpoint,m.arena,m.exit].every(p=>reachable(m,m.spawn,p)),exit:true};}));const output={stageCount:STAGES.length,ringCount:RINGS.length,majorBosses:STAGES.filter(s=>s.major).map(s=>s.id),rows};writeFileSync('qa-output/content-validation.json',JSON.stringify(output,null,2));console.log(`Validated ${rows.length} stage-season combinations; ${rows.filter(r=>!r.reachable).length} unreachable critical paths.`);if(rows.some(r=>!r.reachable))process.exitCode=1;
