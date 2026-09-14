import {freshSave} from '../src/systems/saves';
import {STAGES} from '../src/content/stages';
import {RINGS} from '../src/content/rings';
import {TIERS,BUILDINGS} from '../src/content/home';
import {grantBoss,objectiveReward,credit,pay,upgradeRing,upgradeEquipment} from '../src/systems/economy';
import {discoverRing,rankCap,item} from '../src/systems/progression';
import {writeFileSync} from 'node:fs';
const s=freshSave(),rows:Record<string,unknown>[]=[],deficits:string[]=[];let tier=0;
for(const st of STAGES){const count=st.id===1?1:4;for(let i=0;i<count;i++)objectiveReward(s,st.id,i,count);if(st.id===1)discoverRing(s,'ember');grantBoss(s,st.id,st.id,480);const next=TIERS[tier+1];if(next&&st.id>=next.unlock){if(pay(s,next.cost)){tier++;s.tier=tier;}else deficits.push(`Stage ${st.id}: ${next.name}`);}if(st.id===1){for(const kind of ['forge','workbench','chest','bed']){const d=BUILDINGS.find(b=>b.kind===kind)!;if(!pay(s,d.cost))deficits.push(`Stage 1: ${kind}`);}}
for(const r of RINGS.filter(r=>s.rings[r.id]))while((s.rings[r.id]??1)<rankCap(s.level)&&upgradeRing(s,r.id)){}
for(const slot of ['weapon','armour','boots'] as const){const i=item(s,slot);if(i.upgrade<rankCap(s.level)&&st.id%3===0)upgradeEquipment(s,i.id);}
rows.push({stage:st.id,level:s.level,tier:TIERS[tier].name,gold:s.wallet.gold,wood:s.wallet.wood,stone:s.wallet.stone,iron:s.wallet.iron,shards:s.wallet.shards,rings:Object.keys(s.rings).length,rankCap:rankCap(s.level),lowestRank:Math.min(...Object.values(s.rings)),equipment:s.inventory.filter(i=>Object.values(s.equipment).includes(i.id)).map(i=>i.upgrade).join('/')});}
writeFileSync('qa-output/balance.json',JSON.stringify({method:'Guaranteed boss and objective income only. All rings upgraded whenever affordable. Three equipped slots improved every third stage. All home tiers bought at unlock. No caches, enemy loot, selling, replay income, or random drops.',deficits,rows},null,2));console.log(JSON.stringify({deficits,stage5:rows[4],stage10:rows[9],stage20:rows[19],stage25:rows[24],stage30:rows[29]},null,2));if(tier!==5)process.exitCode=1;
