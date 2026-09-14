import type {BuildingDef,Wallet} from '../types';
export const TIERS=[{name:'No home',unlock:0,cost:{}},{name:'Camp',unlock:1,cost:{gold:40,wood:10}},{name:'Wooden cottage',unlock:5,cost:{gold:250,wood:40,stone:15}},{name:'Stone house',unlock:10,cost:{gold:750,wood:90,stone:90,iron:15}},{name:'Fortified courtyard',unlock:20,cost:{gold:2400,wood:180,stone:220,iron:70}},{name:'Small castle',unlock:25,cost:{gold:5000,wood:250,stone:450,iron:150}}] as {name:string;unlock:number;cost:Partial<Wallet>}[];
export const BUILDINGS:BuildingDef[]=[
{kind:'campfire',name:'Campfire',w:2,h:2,unlock:1,cost:{gold:10,wood:2},purpose:'Gather beside its warmth. Opens residents and the journal.'},
{kind:'shelter',name:'Simple shelter',w:3,h:3,unlock:1,cost:{gold:30,wood:8},purpose:'Your first home. Rest, then upgrade it into a castle.'},
{kind:'bed',name:'Bed',w:2,h:1,unlock:1,cost:{gold:10,wood:3},purpose:'Restore health and flasks. Resting advances one day.'},
{kind:'chest',name:'Storage chest',w:2,h:1,unlock:1,cost:{wood:4},purpose:'Recover overflow equipment and manage your inventory.'},
{kind:'forge',name:'Forge',w:3,h:2,unlock:1,cost:{gold:20,stone:3},purpose:'Upgrade weapons, armour and boots; trade and salvage.'},
{kind:'workbench',name:'Ring workbench',w:2,h:2,unlock:1,cost:{gold:10,wood:4},purpose:'Deterministically upgrade rings and assign them to slots.'},
{kind:'garden',name:'Garden',w:3,h:3,unlock:5,cost:{gold:25,wood:6},purpose:'Prepare a flask infusion: your next expedition flask heals 5 more HP.'},
{kind:'watchtower',name:'Watchtower',w:2,h:2,unlock:10,cost:{gold:80,wood:12,stone:8},purpose:'Survey optional caches and inspect the next boss clue.'},
{kind:'wall',name:'Stone wall',w:2,h:1,unlock:10,cost:{stone:5},purpose:'A defensive landmark. Up to 4 walls each reduce defence damage by 1%.'},
{kind:'gate',name:'Gate',w:3,h:1,unlock:10,cost:{wood:6,iron:2},purpose:'A walkable entrance. Launch a settlement defence after stage 20.'},
{kind:'trophy',name:'Trophy plinth',w:2,h:2,unlock:5,cost:{stone:5},purpose:'Shows the six restored beacon trophies and chapter stories.'},
{kind:'lantern',name:'Lantern',w:1,h:1,unlock:1,cost:{gold:4,iron:1},purpose:'A warm light for the late traveller.'},
{kind:'tree',name:'Rowan tree',w:1,h:1,unlock:1,cost:{gold:3},purpose:'Flowers, leaves and snow mark the passing seasons.'},
{kind:'path',name:'Stone path',w:1,h:1,unlock:1,cost:{stone:1},purpose:'An open walkable path.'},
{kind:'banner',name:'Hearth banner',w:1,h:1,unlock:5,cost:{gold:8,wood:2},purpose:'Display earned colours and defence honours.'}
];
export const buildingByKind=Object.fromEntries(BUILDINGS.map(b=>[b.kind,b]));
const paths={Guardian:['Vitality','Steady guard','Hardiness','Shield rhythm','Iron skin','Firm footing','Defiant heart','Patient counter','Deep breath','Unbroken'],Ranger:['Long stride','Light step','Quick hands','Measured draw','Wide reach','Sure footing','Swift recovery','Hunter’s focus','Feather cloak','Relentless'],Ringkeeper:['Attunement','Kindling','Quiet focus','Resonance','Patient light','Clear mind','Deep ember','Hearth bond','Far sight','Remembered power']};
const descriptions:Record<string,string[]>={
Guardian:['+8 maximum HP.','Guard prevents 4% more damage, within the 85% cap.','Take 3% less direct damage.','Perfect shield parry window is 0.04 seconds longer.','Each armour upgrade grants 2 extra HP.','Perfect defences stagger for 0.2 seconds longer.','Below 35% HP, take 6% less direct damage.','A perfect shield parry also deals 25% weapon damage.','Regenerate 2 extra stamina per second.','+12 maximum HP and 2% direct damage reduction.'],
Ranger:['Move 3.5% faster.','Dodge costs 2 less stamina.','Weapon recovery is 4% faster.','Bow and axe secondary actions charge 15% faster.','Melee weapon reach increases by 10 world units.','Dodge safety lasts 0.02 seconds longer.','Dodge cooldown is 8% shorter.','Bow attacks deal 6% more damage.','+4 maximum stamina and 2% movement speed.','Third combo strikes gain 12% additional damage.'],
Ringkeeper:['Active ring numeric power increases by 3%.','Burn and poison damage increases by 6%.','Ring cooldowns are 3% shorter.','Synergy internal cooldowns are 6% shorter.','Stoneward absorbs 10% additional damage.','Silence from enemy fields lasts 25% less time.','Ordinary enemies remain rooted 0.2 seconds longer.','Last Hearth heals 10% more HP.','Ring cones and light pulse gain up to 15 world units of range.','Casting a ring reduces the other active cooldown by 0.3 seconds. Secondary effects cannot trigger this.']};
export const TALENTS=Object.entries(paths).flatMap(([path,names])=>names.map((name,i)=>({id:path.toLowerCase()+i,path,name,index:i,description:descriptions[path][i]})));
