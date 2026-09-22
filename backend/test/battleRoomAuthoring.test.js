import test from 'node:test';
import assert from 'node:assert/strict';
import { composeProgram } from '../src/services/wrapperGenerator.js';
import { generateStarterCodeForLanguages } from '../src/services/battleRoomAuthoringService.js';

test('builds Java wrappers for linked-list signatures with the needed parsing helpers', () => {
  const signature = {
    name: 'addTwoNumbers',
    returnType: 'ListNode',
    params: [
      { name: 'l1', type: 'ListNode' },
      { name: 'l2', type: 'ListNode' },
    ],
  };

  const program = composeProgram(
    { signature, problemType: 'linked-list' },
    'class Solution { public ListNode addTwoNumbers(ListNode l1, ListNode l2) { return null; } }',
    'java',
    { isFullProgram: true }
  );

  assert.match(program, /static ListNode parseLinkedList/);
  assert.match(program, /class Solution/);
  assert.match(program, /Solution sol = new Solution/);
});

test('returns starter code for only the requested language', () => {
  const question = {
    signature: {
      name: 'twoSum',
      returnType: 'int[]',
      params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }],
    },
  };

  const starters = generateStarterCodeForLanguages(question, ['java']);
  assert.deepEqual(Object.keys(starters), ['java']);
  assert.match(starters.java, /class Solution/);
});
