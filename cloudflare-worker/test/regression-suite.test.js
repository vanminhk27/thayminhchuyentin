import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const suite=JSON.parse(readFileSync(new URL("./regression-cases.json",import.meta.url),"utf8"));
const ids=suite.cases.map(c=>c.id);

test("regression suite contains exactly T01-T24",()=>{
  assert.equal(suite.cases.length,24);
  assert.deepEqual(ids,Array.from({length:24},(_,i)=>"T"+String(i+1).padStart(2,"0")));
});

test("six priority smoke cases match evaluation package",()=>{
  assert.deepEqual(suite.prioritySmoke,["T01","T02","T03","T04","T05","T16"]);
  for(const id of suite.prioritySmoke)assert.equal(suite.cases.find(c=>c.id===id).priority,true);
});

test("T02 follows T01 and T17 uses guide mode",()=>{
  assert.equal(suite.cases.find(c=>c.id==="T02").followUpOf,"T01");
  assert.equal(suite.cases.find(c=>c.id==="T17").level,"guide");
});

test("functional release gate includes T19-T24",()=>{
  assert.deepEqual(suite.releaseThreshold.functionalMustPass,["T19","T20","T21","T22","T23","T24"]);
  for(const id of suite.releaseThreshold.functionalMustPass)assert.equal(suite.cases.find(c=>c.id===id).kind,"functional");
});

test("content cases keep expected rubric separate from user input",()=>{
  for(const c of suite.cases.filter(c=>c.kind==="content")){
    assert.ok(c.input&&c.input.length>10);
    assert.ok(Array.isArray(c.expect)&&c.expect.length>0);
    for(const e of c.expect)assert.equal(c.input.includes(e),false);
  }
});
