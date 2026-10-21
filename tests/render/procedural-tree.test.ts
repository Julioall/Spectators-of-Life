import {describe,expect,it} from 'vitest';
import {treeEngineSpecies,treeFrameIndex,treeVariant,TREE_FRAME_COUNT,TREE_VARIANT_COUNT} from '../../src/modules/biosphere/flora/rendering/trees/tree-art';

describe('tree engine bridge',()=>{
 it('maps simulation species to the internal procedural engine catalog',()=>{
  expect((['oak','pine','birch','autumnal','willow'] as const).map(treeEngineSpecies)).toEqual(['carvalho','pinheiro','bétula','acer','salgueiro']);
 });
 it('assigns unique atlas frames and deterministic cell variants',()=>{
  const frames=new Set<number>();
  for(const species of ['oak','pine','birch','autumnal','willow'] as const){
   for(let stage=0;stage<TREE_FRAME_COUNT;stage+=1){
    for(let variant=0;variant<TREE_VARIANT_COUNT;variant+=1)frames.add(treeFrameIndex(species,stage,variant));
   }
  }
  expect(frames.size).toBe(5*TREE_FRAME_COUNT*TREE_VARIANT_COUNT);
  expect(treeVariant(1947,13,7,'oak')).toBe(treeVariant(1947,13,7,'oak'));
  expect(treeVariant(1947,13,7,'oak')).toBeGreaterThanOrEqual(0);
  expect(treeVariant(1947,13,7,'oak')).toBeLessThan(TREE_VARIANT_COUNT);
 });
});
