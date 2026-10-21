import {describe,expect,it} from 'vitest';
import {Grass} from '../../src/modules/biosphere/flora/rendering/grass/grass';
import {GRASS_NEIGHBORS} from '../../src/modules/biosphere/flora/rendering/grass/strategies/autotile';
const grass=(amount:number)=>({biomassGPerM2:amount,blocked:false,wetland:false});
describe('Flora Grass render module',()=>{
 it('is deterministic for same seed and inputs',()=>{
  const cells=Array.from({length:16},(_,i)=>grass(i%3===0?900:300));
  const a=Grass.renderData(cells,4,4,1947),b=Grass.renderData(cells,4,4,1947);
  expect(a.states).toEqual(b.states);expect(a.masks).toEqual(b.masks);
 });
 it('does not invent grass on barren/blocked cells',()=>{
  const a=Grass.renderData([grass(0),{...grass(900),blocked:true}],2,1,4);
  expect([...a.states].every(v=>v===0)).toBe(true);
 });
 it('supports wetland and 8-neighbour masks',()=>{
  const a=Grass.renderData(Array.from({length:9},()=>({...grass(99999),wetland:true})),3,3,1947,1);
  expect(GRASS_NEIGHBORS).toHaveLength(8);
  expect(a.states[4]).toBe(3);expect(a.masks[4]).toBe(255);
  expect(a.masks[0]).not.toBe(255);
 });
 it('does not mutate source state',()=>{
  const source=Object.freeze([Object.freeze(grass(600))]);
  Grass.renderData(source,1,1,7,2);
  expect(source[0]?.biomassGPerM2).toBe(600);
 });
 it('rejects invalid dimensions',()=>{
  expect(()=>Grass.renderData([grass(300)],2,1,1947)).toThrow(RangeError);
 });
});
