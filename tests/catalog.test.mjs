import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validateGame } from '../counter/ranking.mjs';

const context = vm.createContext({});
for (const file of ['word-bank.js','hints.js','hint-validator.js']) vm.runInContext(fs.readFileSync(file,'utf8'),context);
const {banks,hints,getHintText} = vm.runInContext('({banks:wordBanks,hints,getHintText})',context);
const entries = banks.flatMap(b=>b.words);

test('todas as categorias têm ao menos cinco entradas e Estados contém apenas os 26 estados',()=>{
  const categories = new Map();
  for(const [word,category] of entries){
    if(!categories.has(category))categories.set(category,new Set());
    categories.get(category).add(word);
  }
  assert.equal(entries.length,156);
  assert.equal(categories.size,19);
  for(const [category,words] of categories)assert.ok(words.size>=5,category);
  assert.ok(!entries.some(([word])=>word==='BRASIL'));
  assert.equal(categories.get('Estados').size,26);
  assert.ok(!categories.get('Estados').has('DISTRITO FEDERAL'));
  assert.ok(categories.get('Geografia').has('DISTRITO FEDERAL'));
  assert.equal(categories.get('Capitais').size,27);
  for(const bank of banks)assert.equal(new Set(bank.words.map(([w])=>w)).size,bank.words.length);
});

test('cada palavra exibe sua dica específica e as 74 dicas do autor continuam intactas',()=>{
  const source = fs.readFileSync('DICAS_74_PALAVRAS_PREENCHIDAS.md','utf8');
  const authored = [...source.matchAll(/^\d+\. \*\*(.+?)\*\* — (.+)$/gm)];
  assert.equal(authored.length,74);
  for(const [,word,text] of authored)assert.equal(hints[word],text.trim(),word);
  const originals = new Set(authored.map(m=>m[1]));
  for(const [word,category] of entries){
    assert.ok(typeof hints[word]==='string'&&hints[word].length>0,word);
    assert.equal(getHintText(word,category),hints[word],word);
    if(originals.has(word))continue;
    const count=hints[word].split(/\s+/).length;
    assert.ok(count>=8&&count<=20,`${word}: ${count} palavras`);
    assert.ok(!/começa com|quantidade de letras|categoria|Observe a cena imaginada/i.test(hints[word]),word);
    assert.ok(!hints[word].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().includes(word),word);
  }
});

test('ranking aceita qualquer nova palavra na fase correta, incluindo nomes iguais em Estados e Capitais',()=>{
  const solution=word=>({word,guesses:[...new Set(word.replaceAll(' ',''))]});
  for(const [level,bank] of banks.entries())for(const [word] of bank.words){
    const rounds=banks.slice(0,level).flatMap(b=>b.words.slice(0,5).map(([w])=>solution(w)));
    rounds.push({word,guesses:[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(l=>!word.includes(l)).slice(0,6)});
    const result=validateGame({id:crypto.randomUUID(),name:'Teste',rounds});
    assert.equal(result.wins,level*5,word);
  }
  const rounds=banks.flatMap((bank,level)=>{
    const selection=bank.words.slice(0,5).map(([word])=>word);
    if(level===3||level===4)selection[0]='SAO PAULO';
    return selection.map(solution);
  });
  assert.equal(validateGame({id:crypto.randomUUID(),name:'Teste',rounds}).score,9000);
});
