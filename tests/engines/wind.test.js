import test from 'node:test';import assert from 'node:assert/strict';import {WindField} from '../../src/modules/atmosphere/wind/index.js';
test('wind is deterministic',()=>{const w=new WindField({seed:1947,strength:.5});assert.deepEqual(w.sample(4,3,12),w.sample(4,3,12));});
