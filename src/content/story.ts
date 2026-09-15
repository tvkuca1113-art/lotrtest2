import {chapters} from './strings';
export type StoryPage={eyebrow:string;title:string;body:string;speaker?:string;scene:'road'|'hearth'|'world';};
export const narrative:Record<string,StoryPage[]>={
 prologue:[
  {eyebrow:'PROLOGUE · THE NORTHERN VALLEY',title:'You had only meant to pass through.',body:'A broken sword. An empty purse. Three nights without a roof. Beyond the old bridge, a lantern still burns — and someone is calling for help.',scene:'road'},
  {eyebrow:'SIX BEACONS HAVE GONE DARK',title:'A valley slowly losing its warmth.',body:'Once, the beacon-smiths kept these roads safe. Now their fallen master, the Ashen Regent, draws that light into his fortress. Families flee. Those who cannot leave are left behind.',scene:'road'},
  {eyebrow:'YOUR STORY BEGINS ON ASHEN ROAD',title:'Tonight, find one person worth helping.',body:'Follow the lantern to the stranded survivor. There is no prophecy waiting for you. Only a road, a choice, and perhaps a place to call home.',scene:'road'}
 ],
 alda:[{eyebrow:'ASHEN ROAD · A STRANGER BY THE LANTERN',speaker:'Alda · a smith without a forge',title:'“You came back for me.”',body:'“The toll-taker took our food, then broke the cart. I hid my mother’s ring near the old milestone. It is a little thing, but its ember never went cold. Find it. If we get through this, I know a clearing where we could put up a roof.”',scene:'world'}],
 ember:[{eyebrow:'THE FIRST LESSER RING',title:'A warmth that asks nothing of you.',body:'The metal is warm against your palm. Not a crown, not a promise of dominion — a ring made to keep one family warm. Raise your hand toward the marked brambles. Let a little of that warmth out.',scene:'world'}],
 'first-home':[{eyebrow:'HOMEWARD · THE CLEARING',speaker:'Alda',title:'“A fire first. Then a roof.”',body:'“You broke Gritch’s hold on the road. These supplies are ours now. Put the campfire where you want it. Build a shelter beside it. Tomorrow we can speak of beacons. Tonight, neither of us sleeps in the rain.”',scene:'world'}],
 'ending-valley':[
  {eyebrow:'EPILOGUE · LIGHT ACROSS THE VALLEY',title:'One window. Then another.',body:'You open your hand. The six beacons answer, one ridge after another. Far beyond your walls, strangers set lamps in their windows. The road is no longer a place people only leave.',scene:'hearth'},
  {eyebrow:'ALDA’S WORDS, RECORDED BY SERA',title:'“They arrived with a broken sword.”',body:'“They could have passed through. Instead, they helped me lift a cart. Everything we built began there.” Your hearth remains, and so do the people who made it home. The valley is free. Your journey may continue.',scene:'hearth'}
 ],
 'ending-hearth':[
  {eyebrow:'EPILOGUE · A LIGHT TO FIND YOUR WAY',title:'No traveller turned away.',body:'You gather the light above the roofs you raised. It becomes a steady golden pillar. Through rain and snow, the lost can see it. The first shelter has become a refuge for the whole valley.',scene:'hearth'},
  {eyebrow:'SERA’S LAST PAGE',title:'“A home is a promise kept.”',body:'The Regent wanted the valley to kneel beneath one light. You leave the gate open beneath yours. Alda tends her forge. Someone puts another bed by the warm wall. Your story has an ending — and your home has a tomorrow.',scene:'hearth'}
 ]
};
const leads=[
 'The road is open, but its beacon remains dark. Alda remembers the mills and farmsteads beyond the bridge. Their stores could feed a first settlement.',
 'The first beacon burns again. Yet no scout has returned from Thornwood. Alda points to the forest: if the other beacons are to answer, someone must reopen its paths.',
 'Taren’s maps lead into the mountains. Water no longer runs from the quarry, but its abandoned furnaces glow at night. A mason is still alive somewhere below.',
 'Borin finds iron from the stolen beacons in the chains. They lead to an occupied borderland, where siege camps are burning the valley’s last fields.',
 'Mira’s seeds are safe at home. Beyond the liberated border, winter lingers among the barrows. A healer went to recover the names of the dead. A black rider followed.',
 'The rider has been driven back. Five beacons shine toward the fortress, but the last still drains their light. Sera has found the road to the Regent’s first forge.'
];
chapters.forEach((c,i)=>{
 narrative['chapter-'+i]=[{eyebrow:`CHAPTER ${i+1} · ${c.region.toUpperCase()}`,title:c.name,body:leads[i],scene:'world'}];
 narrative['return-'+i]=[{eyebrow:`BEACON ${i+1} RESTORED · HOMEWARD`,speaker:c.resident,title:c.change,body:c.dialogue+' '+(i<5?leads[i+1]:'What began beside a broken cart has become a place of welcome.'),scene:'world'}];
});
export const storyUI={next:'Continue',begin:'Step onto Ashen Road',skip:'Skip introduction',return:'Return to the journey',replay:'Read the prologue',chronicle:'THE STORY SO FAR',subtitle:'LIVING VALLEY UPDATE · v0.2',storyHint:'The world waits while you read.',roadHint:'Follow the lantern. Speak to the survivor.',atHome:'A light to come home to.'};
