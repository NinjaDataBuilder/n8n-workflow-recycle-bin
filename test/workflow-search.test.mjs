import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendSearchTerm,
  buildSearchFeedback,
  consumeDelimitedInput,
  filterWorkflowItems,
} from '../app/public/assets/workflow-search.mjs';

const workflows = [
  { workflowName: 'Baserow - MCP CRUD test', project: 'Alexandre Ninja' },
  { workflowName: 'Baserow - restore original rows', project: 'Alexandre Ninja' },
  { workflowName: 'Baserow - Schema Admin create test table', project: 'Alexandre Ninja' },
  { workflowName: 'Baserow - Schema Admin create field test', project: 'Alexandre Ninja' },
];

test('filters archived workflows incrementally by normalized workflow name', () => {
  assert.equal(filterWorkflowItems(workflows, 'Baserow').length, 4);
  assert.deepEqual(
    filterWorkflowItems(workflows, '  FIELD  ').map((item) => item.workflowName),
    ['Baserow - Schema Admin create field test'],
  );
  assert.equal(filterWorkflowItems(workflows, 'não existe').length, 0);
  assert.equal(filterWorkflowItems([{ workflowName: 'Integração' }], 'integracao').length, 1);
});

test('matches every independent search tag regardless of position or order', () => {
  assert.deepEqual(
    filterWorkflowItems(workflows, ['Schema', 'field']).map((item) => item.workflowName),
    ['Baserow - Schema Admin create field test'],
  );
  assert.deepEqual(
    filterWorkflowItems(workflows, ['FIELD', 'schema']).map((item) => item.workflowName),
    ['Baserow - Schema Admin create field test'],
  );
  assert.equal(filterWorkflowItems(workflows, ['Schema', 'missing']).length, 0);
});

test('turns comma-delimited input into deduplicated tags and an editable remainder', () => {
  assert.deepEqual(consumeDelimitedInput('Schema, field'), {
    committed: ['Schema'],
    remainder: 'field',
  });
  assert.deepEqual(consumeDelimitedInput('Schema,field,'), {
    committed: ['Schema', 'field'],
    remainder: '',
  });
  assert.deepEqual(appendSearchTerm(['Schema'], ' schema '), ['Schema']);
  assert.deepEqual(appendSearchTerm(['Integração'], 'integracao'), ['Integração']);
  assert.deepEqual(appendSearchTerm(['Schema'], 'field'), ['Schema', 'field']);
});

test('explains whether a query kept, narrowed, or exhausted the archived workflow list', () => {
  assert.deepEqual(buildSearchFeedback(4, 4, ''), {
    countText: '4 archived workflows',
    emptyText: 'No archived workflows are visible to your account.',
  });
  assert.equal(buildSearchFeedback(4, 4, 'Baserow').countText, '4 of 4 archived workflows found');
  assert.equal(buildSearchFeedback(4, 1, 'field').countText, '1 of 4 archived workflows found');
  assert.deepEqual(buildSearchFeedback(4, 0, 'wrong name'), {
    countText: '0 of 4 archived workflows found',
    emptyText: 'No archived workflows match the search terms.',
  });
});
