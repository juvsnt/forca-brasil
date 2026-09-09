import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('index.html','utf8');
const selection=html.slice(html.indexOf('function newWord(){'),html.indexOf('\nfunction render'));

function draw({words,random=[0,0],counts={},previous='',seen=[],used=[]}) {
  let calls=0,history=[...seen];
  const math=Object.create(Math);
  math.random=()=>{assert.ok(calls<random.length,'Sorteios além do esperado');return random[calls++];};
  const context=vm.createContext({
    Math:math,levels:[{words}],state:{level:0,used:[...used],categoryCounts:{...counts},previousCategory:previous},
    norm:s=>s.toUpperCase(),getSeen:()=>history,setSeen:value=>{history=value},
    $:()=>({textContent:''}),render(){},finish(){throw new Error('Avanço inesperado');}
  });
  vm.runInContext(selection+';newWord()',context);
  return {state:context.state,history:Array.from(history),calls};
}

test('categorias empatadas têm chances iguais mesmo com bancos de tamanhos diferentes',()=>{
  const words=[['UNICA','Pequena'],...Array.from({length:9},(_,i)=>['PALAVRA'+i,'Grande'])];
  const totals={Pequena:0,Grande:0};
  // Percorre uniformemente o espaço do primeiro sorteio, sem depender de sorte em um teste estatístico.
  for(let i=0;i<100;i++){
    const result=draw({words,random:[(i+.5)/100,.5]});
    totals[result.state.category]++;
    assert.equal(result.calls,2);
  }
  assert.deepEqual(totals,{Pequena:50,Grande:50});
});

test('segundo sorteio percorre apenas palavras da categoria escolhida',()=>{
  const words=[['A','Menor'],['B','Maior'],['C','Maior'],['D','Maior']];
  const actual=[.1,.5,.9].map(value=>draw({words,random:[.9,value]}).state.answer);
  assert.deepEqual(actual,['B','C','D']);
});

test('prioriza menor uso e evita categoria anterior quando há alternativas',()=>{
  const words=[['A','Primeira'],['B','Segunda'],['C','Terceira']];
  assert.equal(draw({words,counts:{Primeira:3,Segunda:0,Terceira:2},random:[.99,.99]}).state.category,'Segunda');
  assert.equal(draw({words,previous:'Segunda',counts:{Primeira:2,Segunda:0,Terceira:1}}).state.category,'Terceira');
});

test('histórico e palavras usadas restringem as opções sem impedir reciclagem do banco',()=>{
  const words=[['A','Primeira'],['B','Primeira'],['C','Segunda']];
  const result=draw({words,used:[0],seen:['A','C'],previous:'Primeira'});
  assert.equal(result.state.answer,'B');
  assert.equal(result.state.categoryCounts.Primeira,1);
  assert.deepEqual(result.history,['A','C','B']);
  const recycled=draw({words,used:[0],seen:['A','B','C','OUTRA FASE'],previous:'Primeira'});
  assert.equal(recycled.state.answer,'C');
  assert.deepEqual(recycled.history,['OUTRA FASE','C']);
});
