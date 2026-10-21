import test from 'node:test';
import assert from 'node:assert/strict';
import {createRockEngine} from '../../src/modules/geosphere/rendering/rocks/index.js';
test('rock catalog and world generation reproducible without canvas',()=>{
 const rocks=createRockEngine();assert.equal(rocks.catalogs.families.length,8);
 assert.equal(rocks.catalogs.geologies.length,6);
 const a=rocks.generate({seed:1947}),b=rocks.generate({seed:1947}),c=rocks.generate({seed:1948});
 assert.deepEqual(a,b);assert.notDeepEqual(a.deposits,c.deposits);
 assert.ok(a.deposits.length>0);
 assert.equal(a.terrain.masks.length,20*14);
 assert.equal(a.grid.owner.length,20*14);
});
test('independent geology and rarity parameters do not change other libraries',()=>{
 const rocks=createRockEngine();
 const d=rocks.createDeposit({seed:2017,biome:'volcanic',forma:'shard',material:'ouro',rarity:'epic',geology:'basalt'});
 assert.equal(d.family,'shard');assert.equal(d.material,'ouro');assert.equal(d.rarity,'epic');assert.equal(d.geology,'basalt');
 assert.ok(d.grade>.85);
});
test('legacy embedded images are not present in the rock library source',async()=>{
 const fs=await import('node:fs/promises');
 const source=await fs.readFile(new URL('../../src/modules/geosphere/rendering/rocks/engine.js',import.meta.url),'utf8');
 assert.ok(!source.includes('data:image/png;base64'));
 assert.ok(!source.includes('SPRITES_LEGACY'));
 assert.ok(!source.includes('new Image('));
});
