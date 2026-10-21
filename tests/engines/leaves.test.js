import test from 'node:test';
import assert from 'node:assert/strict';
import {LeafEngine,LeafProductionRuntime,LeafGenetics} from '../../src/modules/biosphere/flora/rendering/leaves/index.js';
test('shared leaf module exports G7/G8 directly',()=>{
 assert.equal(typeof LeafEngine.renderLeaf,'function'); assert.equal(typeof LeafProductionRuntime,'function');
 assert.equal(typeof LeafGenetics.createGenome,'function');
});
