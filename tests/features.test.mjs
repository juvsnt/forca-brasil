import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import worker, { normalizeIP } from '../counter/worker.mjs';

test('dicas: cobertura, uma leitura por rodada, bloqueio durante modal e cinco níveis', () => {
  const elements = new Map();
  const element = () => ({ style: {}, classList: { toggle(){}, add(){} }, children: [],
    textContent: '', innerHTML: '', disabled: false, open: false, listeners: {},
    setAttribute(){}, appendChild(x){ this.children.push(x); }, focus(){},
    addEventListener(name, fn){ this.listeners[name] = fn; },
    showModal(){ this.open = true; }, close(){ this.open = false; this.listeners.close?.(); }
  });
  const sandbox = {
    assert, crypto, GlobalRanking: { games: [], enqueue(game){this.games.push(game)},refresh(){} }, document: {
      getElementById(id){ if(!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      querySelectorAll(){ return []; }, createElement: element, addEventListener(){}
    }, localStorage: {
      data: {}, getItem(k){ return this.data[k] || null; }, setItem(k,v){ this.data[k] = v; }
    }, setTimeout(){}
  };
  vm.createContext(sandbox);
  const html = fs.readFileSync('index.html', 'utf8');
  vm.runInContext(fs.readFileSync('hints.js', 'utf8'), sandbox);
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], sandbox);
  vm.runInContext(`
    audioOn=false; start('Teste');
    assert.equal(levels.flatMap(l=>l.words).length,25);
    for(const level of levels) for(const [word] of level.words) {
      assert.ok(hints[norm(word)]?.length>30);
      assert.ok(!norm(hints[norm(word)]).includes(norm(word)));
    }
    for(let i=0;i<25;i++) {
      assert.equal($('hintButton').disabled,false);
      $('hintButton').onclick();
      assert.equal($('hintDialog').open,true);
      assert.equal($('hintText').textContent,hints[state.answer]);
      guess('Z'); assert.equal(state.guessed.length,0);
      $('hintDialog').close();
      assert.equal($('hintText').textContent,'');
      $('hintButton').onclick(); assert.equal($('hintDialog').open,false);
      for(const l of new Set(state.answer.replaceAll(' ',''))) guess(l);
      assert.equal(state.roundOver,true);
      assert.equal($('hintButton').disabled,true);
      newWord();
    }
    assert.equal(state.wins,25);
    assert.equal(GlobalRanking.games.length,1); assert.equal(GlobalRanking.games[0].rounds.length,25); save(); assert.equal(GlobalRanking.games.length,1);
  `, sandbox);
});

test('contador: IP único, concorrência, persistência SQL, leitura e falhas', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync('counter/schema.sql', 'utf8'));
  const env = { ALLOWED_ORIGIN: 'https://juvsnt.github.io', IP_HASH_SECRET: 'test-secret-only-'.repeat(4), DB: {
    prepare(sql){ return { sql, args: [], bind(...args){this.args=args;return this;}, async first(){return db.prepare(sql).get();} }; },
    async batch(statements){
      db.exec('BEGIN');
      try {
        const results = statements.map(s => ({results: s.sql.startsWith('SELECT') ? db.prepare(s.sql).all(...s.args) : (db.prepare(s.sql).run(...s.args), [])}));
        db.exec('COMMIT'); return results;
      } catch(e) { db.exec('ROLLBACK'); throw e; }
    }
  }};
  const request = (ip, method='POST', origin=env.ALLOWED_ORIGIN) => new Request('https://example.test/visits', {
    method, headers: {Origin:origin, ...(ip ? {'CF-Connecting-IP':ip} : {})}
  });
  const visit = async ip => (await worker.fetch(request(ip),env)).json();
  assert.equal((await visit('192.0.2.1')).count,1);
  assert.equal((await visit('192.0.2.1')).count,1);
  await Promise.all(Array.from({length:20},()=>visit('192.0.2.2')));
  assert.equal((await visit('192.0.2.2')).count,2);
  assert.equal((await visit('2001:db8::1')).count,3);
  assert.equal((await visit('2001:0db8:0:0:0:0:0:1')).count,3);
  assert.equal((await visit('::ffff:192.0.2.1')).count,3);
  assert.equal(normalizeIP('not-an-ip'),null);
  assert.equal((await worker.fetch(request(null),env)).status,400);
  assert.equal((await worker.fetch(request('192.0.2.3','POST','https://wrong.test'),env)).status,403);
  assert.equal((await worker.fetch(request(null,'OPTIONS'),env)).status,204);
  assert.equal((await worker.fetch(request(null,'DELETE'),env)).status,405);
  assert.equal((await (await worker.fetch(request(null,'GET'),env)).json()).count,3);
  assert.equal((await worker.fetch(request('192.0.2.4'),{...env,IP_HASH_SECRET:''})).status,503);
  for(const row of db.prepare('SELECT * FROM visitors').all()) assert.match(row.ip_hash,/^[a-f0-9]{64}$/);
  assert.equal(db.prepare('SELECT count FROM totals').get().count,3);
  db.close();
});

test('interface do contador: singular, plural, indisponibilidade e ausência de configuração', async () => {
  for (const value of [1, 1234, -1, '5', null]) {
    const elements = new Map(['visitorBadge','visitorCount','visitorNoun'].map(id => [id,{hidden:true,textContent:''}]));
    const sandbox = { window:{FORCA_COUNTER_URL:'https://example.test/visits'}, document:{getElementById:id=>elements.get(id)}, AbortSignal,
      fetch: async()=>({ok:value!==null,json:async()=>({count:value})}) };
    vm.createContext(sandbox);
    await vm.runInContext(fs.readFileSync('counter-client.js','utf8'),sandbox);
    assert.equal(elements.get('visitorBadge').hidden,!(typeof value==='number'&&value>0));
    if(value===1) assert.equal(elements.get('visitorNoun').textContent,'visitante já entrou');
    if(value===1234) assert.equal(elements.get('visitorCount').textContent,'1.234');
  }
  const sandbox = { window:{FORCA_COUNTER_URL:''}, fetch:()=>{throw new Error('Não deve acessar rede');} };
  vm.createContext(sandbox);
  await vm.runInContext(fs.readFileSync('counter-client.js','utf8'),sandbox);
});
