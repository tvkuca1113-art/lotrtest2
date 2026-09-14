import type {StageDef,EnemyKind,ObjectiveKind,AttackKind} from '../types';
const rows:[string,string,ObjectiveKind,string,EnemyKind,string,AttackKind[][],string][]=[
['Ashen Road','Rescue the stranded survivor','rescue','Gritch, the Toll-Taker','goblin','Read two swings, then punish recovery',[['double','sweep']],'Your last coin, stranger. Or your last breath.'],
['Broken Mill','Recover three provision sacks','supply','Kruk Hookhand','orc','Step aside from the hook and punish its recovery',[['hook','sweep','charge']],'All roads bend to my hook.'],
['Barrow Crossing','Silence the cursed bells','ritual','The Bell-Wight','wight','Find gaps in expanding sound rings',[['waves','leap','waves']],'Listen. They still call for home.'],
['Wolf Pass','Reopen the marked route','route','Greyfang','warg','Dodge sideways against a committed charge',[['charge','leap','double']],'A silver muzzle emerges between the standing stones.'],
['Rootbound Watch','Reclaim the first beacon','beacon','Mogrun, the Siege Troll','troll','Bait a charge into the marked pillars',[['slam','charge'],['double','charge','shock']],'Little flame. Big shadow.'],
['Thornwood Trail','Free three trapped scouts','rescue','Ssilka, Broodkeeper','spider','Cut webs and control limited hatchlings',[['web','leap','pools']],'The roots move. Then you see the legs.'],
['Fallen Waystation','Recover the scattered map','records','The Briar Archer','uruk','Use stone cover against arrow lanes',[['lanes','leap','lanes','sweep']],'There is no road beyond this arrow.'],
['Sunken Shrine','Restore the drowned lanterns','ritual','Norgath of the Mire','troll','Reposition between pools and sweeping blows',[['pools','sweep','shock']],'The shrine belongs to what sleeps beneath it.'],
['Whispering Grove','Destroy three dark wards','sabotage','The Hush-Caller','wight','Escape silence zones; strike during channels',[['silence','waves','sectors']],'Even your name will fade here.'],
['Hollow Crown','Recover the forest beacon','beacon','Queen of the Ashweb','spider','Maintain routes through changing webs',[['web','leap','lanes'],['web','pools','double','leap']],'A crown of silk rises above the ash.'],
['Old Quarry','Reopen the supply winches','supply','Rockjaw','troll','Distinguish a quick swing from a delayed slam',[['sweep','slam','sweep','shock']],'Stone breaks. You break easier.'],
['Furnace Tunnels','Rescue the trapped stoneworkers','rescue','Bragg, Furnace Master','orc','Read vent warnings and avoid armed mines',[['mines','breath','sweep']],'I will put your bones to work.'],
['Icebridge','Secure three crossing anchors','route','Whitefang','warg','React to alternating leaps and landing markers',[['leap','charge','leap','shock']],'Tracks end at the edge. Something lands behind you.'],
['Hall of Anvils','Recover the ancient records','records','The Iron Echo','uruk','Separate the strike from its delayed repeat',[['echo','double','echo','waves']],'The hall strikes twice.'],
['The Chained Deep','Recover the mountain beacon','beacon','Durnok the Chained','troll','Break exposed anchors between chain sweeps',[['chain','slam'],['chain','shock','charge']],'Break my chains, if you can survive them.'],
['Flooded Ford','Escort the cart between safe stops','escort','Karg Shieldmarshal','uruk','Bait a shield charge to expose his back',[['shield','charge','sweep']],'Your supplies stay here.'],
['Siegeworks','Disable the siege engines','sabotage','Uzg the Engineer','goblin','Bait the ballista line toward the engineer',[['ballista','mines','lanes']],'Stand still. I am calibrating.'],
['Bannerfield','Break three supporting banners','sabotage','The War-Drummer','uruk','Destroy banners and manage reinforcements',[['banners','waves','double']],'One drum. A hundred feet.'],
['Ember Watch','Light the warning braziers','ritual','The Cinder Knight','uruk','Bait a counter; punish the long recovery',[['counter','sweep','breath']],'I remember being cold. Never again.'],
['Red Banner Keep','Liberate the border beacon','beacon','Varzug, Banner-Lord','uruk','Duel, charges, then marked siege fire',[['double','counter'],['charge','shield'],['ballista','sectors','double']],'A valley is only a thing to be held.'],
['Mirror Barrows','Retrieve the buried name-stones','records','The Glass Wight','wight','The real wight casts a solid shadow',[['shadow','echo','waves']],'Which of us remembers you?'],
['Obsidian Passage','Open the sealed road','route','The Rift Keeper','wight','Cross between alternating ground fissures',[['fissures','charge','sectors']],'Every step is a small surrender.'],
['Winter Tower','Recover the healer supplies','supply','Keeper of the Pale Flame','wight','Rotate into the unmarked sector during channels',[['sectors','waves','silence']],'Come closer. This fire is almost warm.'],
['Fallen Courtyard','Repair the three bridge spans','bridge','The Oathbreaker Giant','troll','Dodge shockwaves, then strike exposed knees',[['shock','slam','charge']],'No one crosses while I stand.'],
['Black Causeway','Reclaim the haunted beacon','beacon','The Nameless Nazgûl','nazgul','Evade the mounted rush and spectral ring gaps',[['charge','lanes'],['waves','shadow','sectors']],'The rider’s cry thins the air. Hold your ground.'],
['Siege Trench','Breach three defensive charges','sabotage','Master Sapper Gruk','goblin','Keep a route through timed explosives',[['explosives','mines','leap']],'Mind your step. I certainly did.'],
['Smouldering Forge','Extinguish the ash furnaces','ritual','Cindermaw','troll','Evade sweeping breath and attack during cooling',[['breath','pools','slam']],'The furnace exhales a living shape.'],
['Broken Citadel','Recover the beacon key','records','The Black Castellan','uruk','Read the shield, blade and bow stances',[['stances','shield','lanes','double']],'The keep has no door for you.'],
['Last Beacon','Sever the three conduit roots','sabotage','The Oath-Thief','regent','Counter readable copies of familiar ring powers',[['ringcopy','echo','sectors','charge']],'Everything you wear was once someone else’s hope.'],
['Eclipse Summit','Free the last bound survivors','rescue','The Ashen Regent','regent','Duel, read seasonal fields, break the final conduits',[['double','counter','charge'],['seasons','waves','breath'],['conduit','sectors','echo']],'I built a crown because I could not rebuild a home.']
];
const stories=['A carved milestone remembers the families who travelled this road.','A ribbon survives on a branch above an empty chair.','The stone reads: Leave one lamp for the late shift.','An orchard is drawn beneath the war-map.','A name under the snow is still a name.','A cold hearth stands behind the Regent’s discarded crown.'];
export const STAGES:StageDef[]=rows.map((r,i)=>({id:i+1,name:r[0],objective:r[1],kind:r[2],boss:r[3],enemy:r[4],test:r[5],attacks:r[6],intro:r[7],chapter:Math.floor(i/5),major:(i+1)%5===0,recommended:Math.min(30,i+1),seed:179+i*977,clue:r[5],story:stories[Math.floor(i/5)]}));
export const stageById=(id:number)=>STAGES[Math.max(0,Math.min(29,id-1))];
