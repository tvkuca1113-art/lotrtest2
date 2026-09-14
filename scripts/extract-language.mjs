// One-time, AST-based extraction. Logic identifiers remain unchanged.
import ts from 'typescript';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const files=['src/main.ts','src/ui/ui.ts','src/game/engine.ts','src/game/scene.ts','src/game/audio.ts','src/game/input.ts','src/systems/saves.ts','src/systems/progression.ts','src/systems/economy.ts','src/systems/building.ts','src/systems/seasons.ts'];
const dictionary=existsSync('src/content/messages.en.json')?JSON.parse(readFileSync('src/content/messages.en.json','utf8')):{};
const reverse=new Map(Object.entries(dictionary).map(([k,v])=>[v,k]));
for(const file of files){
 let added=0;
 const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const human=text=>/[A-Za-z]{2,}[\s][A-Za-z]{2,}|[A-Za-z][·…]|>[^<>{]*[A-Za-z]{2,}/.test(text)&&!/^\^/.test(text);
 const keyFor=text=>{if(reverse.has(text))return reverse.get(text);const base=file.split('/').at(-1).split('.')[0];let n=Object.keys(dictionary).filter(k=>k.startsWith(base+'.')).length+1;const key=base+'.'+String(n).padStart(3,'0');dictionary[key]=text;reverse.set(text,key);return key;};
 const transform=context=>{
  const visit=node=>{
   if(ts.isTemplateExpression(node)){
    const parts=[node.head.text,...node.templateSpans.map(s=>s.literal.text)];
    const text=parts.map((part,i)=>part+(i<parts.length-1?'{'+i+'}':'')).join('');
    if(human(text)){added++;return ts.factory.createCallExpression(ts.factory.createIdentifier('message'),undefined,[ts.factory.createStringLiteral(keyFor(text)),...node.templateSpans.map(s=>ts.visitNode(s.expression,visit))]);}
   }
   if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&human(node.text)&&!ts.isImportDeclaration(node.parent)&&!ts.isLiteralTypeNode(node.parent)){
    // Object property names and imports are identifiers, not presentation.
    if((ts.isPropertyAssignment(node.parent)&&node.parent.name===node)||ts.isImportDeclaration(node.parent))return node;
    added++;return ts.factory.createCallExpression(ts.factory.createIdentifier('message'),undefined,[ts.factory.createStringLiteral(keyFor(node.text))]);
   }
   return ts.visitEachChild(node,visit,context);
  };
  return root=>ts.visitNode(root,visit);
 };
 const result=ts.transform(source,[transform]);
 let text=ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(result.transformed[0]);
 if(added){const prefix=file==='src/main.ts'?'./content/messages':'../content/messages';text=`import { message } from '${prefix}';\n`+text;}
 writeFileSync(file,text);result.dispose();
}
writeFileSync('src/content/messages.en.json',JSON.stringify(dictionary,null,2)+'\n');
console.log(Object.keys(dictionary).length+' presentation messages extracted.');
