import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionService } from '../src/services/executionService.js';

test('sends execution requests to the secure code engine with the required contract', async () => {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          submissionId: 'sub-1',
          submittedAt: '2026-01-01T00:00:00.000Z',
          status: 'ACCEPTED',
          accepted: true,
          passed: 1,
          failed: 0,
          total: 1,
          output: '',
          error: '',
          executionTime: 2,
          memoryUsed: 64,
          results: [
            {
              status: 'PASSED',
              executionTime: 2,
              memoryUsed: 64,
              output: '42',
              expectedOutput: '42',
            },
          ],
          timestamp: '2026-01-01T00:00:00.000Z',
        };
      },
    };
  };

  try {
    const service = new ExecutionService('https://secure-code-engine.onrender.com/api/v1/execute');
    const response = await service.execute('print(42)', [{ input: '', expectedOutput: '42' }], 'python');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://secure-code-engine.onrender.com/api/v1/execute');
    assert.equal(calls[0].options.method, 'POST');

    const payload = JSON.parse(calls[0].options.body);
    assert.deepEqual(payload, {
      language: 'python',
      code: 'print(42)',
      timeLimit: 2000,
      memoryLimit: 65536,
      testCases: [{ input: '', expectedOutput: '42' }],
    });
    assert.equal(response.accepted, true);
  } finally {
    global.fetch = originalFetch;
  }
});
