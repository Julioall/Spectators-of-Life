import {describe,expect,it} from 'vitest';
import {generateGrassAutotile,GRASS_NEIGHBORS} from '../../src/lib/asterra/vegetation/grass-autotile';
const grass=(amount:number)=>({biomassGPerM2:amount,blocked:false,wetland:false});
describe('ASTERRA autotile visual library',()=>{
 it('is deterministic for same seed and inputs',()=>{
  const cells=Array.from({length:16},(_,i)=>grass(i%3===0?900:300));
  const a=generateGrassAutotile(cells,4,4,1947),b=generateGrassAutotile(cells,4,4,1947);
  expect(a.states).toEqual(b.states);expect(a.masks).toEqual(b.masks);
 });
 it('does not invent grass on barren/blocked cells',()=>{
  const a=generateGrassAutotile([grass(0),{...grass(900),blocked:true}],2,1,4);
  expect([...a.states].every(v=>v===0)).toBe(true);
 });
 it('supports wetland and 8-neighbour masks',()=>{
  const a=generateGrassAutotile(Array.from({length:9},()=>({...grass(99999),wetland:true})),3,3,1947,1);
  expect(GRASS_NEIGHBORS).toHaveLength(8);
  expect(a.states[4]).toBe(3);expect(a.masks[4]).toBe(255);
  expect(a.masks[0]).not.toBe(255);
 });
 it('does not mutate source state',()=>{
  const source=Object.freeze([Object.freeze(grass(600))]);
  generateGrassAutotile(source,1,1,7,2);
  expect(source[0]?.biomassGPerM2).toBe(600);
 });
 it('rejects invalid dimensions',()=>{
  expect(()=>generateGrassAutotile([grass(300)],2,1,1947)).toThrow(RangeError);
 });
});
