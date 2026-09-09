import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import worker from '../counter/worker.mjs';
import { validateGame } from '../counter/ranking.mjs';
import words from '../counter/words.json' with { type: 'json' };

function game(wins=0) {
  const all = words.flatMap((bank,level) => bank.slice(0,5).map(word => ({word,level}))); const rounds = all.slice(0,wins).map(({word}) => ({word,guesses:[...new Set(word.replaceAll(' ',''))]}));
  if(wins<25) { const {word}=all[wins]; rounds.push({word,guesses:[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(l=>!word.includes(l)).slice(0,6)}); }
  return {id:crypto.randomUUID(),name:'Jogador teste',rounds};
}
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync('counter/schema.sql','utf8'));
  sql.exec(fs.readFileSync('counter/ranking.sql','utf8'));
  const DB = {
    prepare(query) { return { query,args:[],bind(...args){this.args=args;return this},async all(){return {results:sql.prepare(query).all(...this.args)}},async first(){return sql.prepare(query).get(...this.args)}}; },
    async batch(statements) {
      sql.exec('BEGIN');
      try { const result=statements.map(s=>({results:s.query.startsWith('SELECT')?sql.prepare(s.query).all(...s.args):(sql.prepare(s.query).run(...s.args),[])}));sql.exec('COMMIT');return result; }
      catch(error){sql.exec('ROLLBACK');throw error;}
    }
  };
  return {sql,DB};
}
test('valida todas as fases, recalcula pontos e rejeita rodadas impossíveis',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const bank=fs.readFileSync('word-bank.js','utf8');
  const declaration='const levels=wordBanks;';
  assert.equal(JSON.stringify(vm.runInNewContext(bank+';'+declaration+'levels').map(l=>l.words.map(w=>w[0].toUpperCase()))),JSON.stringify(words));
  assert.equal(validateGame(game(25)).score,9000);
  assert.equal(validateGame(game(5)).level,2);
  const forged=game(1);forged.score=999999;assert.equal(validateGame(forged).score,160);
  for(const change of [g=>g.rounds[0].guesses.push('A'),g=>g.rounds[0].word='INVENTADO',g=>g.name='<script>',g=>g.rounds=[],g=>g.id='abc']) {
    const g=game();change(g);assert.throws(()=>validateGame(g));
  }
  const unfinished=game(1);unfinished.rounds.pop();assert.throws(()=>validateGame(unfinished));
  const repeated=game(2);repeated.rounds[1]=repeated.rounds[0];assert.throws(()=>validateGame(repeated));
});
test('ranking compartilhado: top 10, desempate estável, envio idempotente e erros',async()=>{
  const {sql,DB}=database(), env={DB,ALLOWED_ORIGIN:'https://juvsnt.github.io'};
  const req=(body,method='POST',origin=env.ALLOWED_ORIGIN)=>new Request('https://test.invalid/ranking',{method,headers:{Origin:origin,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
  const original=game(2);
  assert.equal((await worker.fetch(req(original),env)).status,200);
  await Promise.all(Array.from({length:6},()=>worker.fetch(req(original),env)));
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM scores').get().n,1);
  assert.equal((await worker.fetch(req({...original,name:'Outro'}),env)).status,409);
  for(let i=0;i<12;i++)assert.equal((await worker.fetch(req({...game(i),name:'Pessoa '+i}),env)).status,200);
  const read=await worker.fetch(req(null,'GET'),env);
  assert.equal(read.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGIN);
  const entries=(await read.json()).entries;
  assert.equal(entries.length,10);
  assert.equal(entries[0].name,'Pessoa 11');
  assert.ok(entries.every((x,i)=>i===0||x.score<=entries[i-1].score));
  assert.equal((await worker.fetch(req(game(),'POST','https://outro.invalid'),env)).status,403);
  assert.equal((await worker.fetch(req({} ),env)).status,400);
  assert.equal((await worker.fetch(req({payload:'x'.repeat(17000)}),env)).status,413);
  assert.equal((await worker.fetch(req(null,'OPTIONS'),env)).headers.get('Access-Control-Allow-Headers'),'Content-Type');
  assert.equal((await worker.fetch(req(null,'GET'),{...env,DB:{prepare(){throw Error()}}})).status,503);
  sql.close();
});
test('cliente mantém envio pendente após falha e reenvia o mesmo ID',async()=>{
  const elements=new Map();
  const el=()=>({textContent:'',children:[],appendChild(x){this.children.push(x)},replaceChildren(){this.children=[]}});
  let offline=true, posts=[];
  const sandbox={URL,AbortSignal,window:{FORCA_COUNTER_URL:'https://test.invalid/visits'},localStorage:{data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=v}},document:{getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id)},createElement:el},fetch:async(url,options)=>{
    if(offline)throw Error('offline');
    if(options.method==='POST')posts.push(JSON.parse(options.body));
    return {ok:true,json:async()=>options.method==='POST'?{saved:true}:{entries:[{name:'Pessoa',wins:1,level:1,score:160}]}};
  }};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('ranking-client.js','utf8'),sandbox);
  sandbox.game=game(1);
  vm.runInContext('GlobalRanking.enqueue(game)',sandbox);
  await vm.runInContext('GlobalRanking.refresh()',sandbox);
  assert.equal(JSON.parse(sandbox.localStorage.data.forcaBrasilPendingScores).length,1);
  assert.match(elements.get('rankStatus').textContent,/pendente/);
  offline=false;
  await vm.runInContext('GlobalRanking.refresh()',sandbox);
  assert.equal(posts[0].id,sandbox.game.id);
  assert.equal(JSON.parse(sandbox.localStorage.data.forcaBrasilPendingScores).length,0);
  assert.equal(elements.get('rankRows').children.length,1);
  assert.match(elements.get('rankStatus').textContent,/salvo/);
});
