import test from 'node:test';
import assert from 'node:assert/strict';
import {createTreeEngine} from '../../src/modules/biosphere/flora/rendering/trees/engine/index.js';
test('26 tree species, reproducible genomes and persistent attachment IDs',()=>{
 const trees=createTreeEngine(); assert.equal(trees.catalog.length,26);
 for(const species of trees.catalog){
   const first=trees.create({species,seed:1947}),second=trees.create({species,seed:1947});
   assert.deepEqual(first,second,species);
   assert.ok(first.branches.length>0,species);
   assert.ok(first.morphology.foliageSites?.length>0,species);
 }
});
test('tree instances stay isolated without global mutation',()=>{
 const a=createTreeEngine(),b=createTreeEngine();
 assert.notEqual(a,b);
 assert.notDeepEqual(a.create({species:'carvalho',seed:1}),a.create({species:'carvalho',seed:2}));
});
