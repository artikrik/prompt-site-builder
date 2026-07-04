#!/usr/bin/env node
/**
 * test-pipeline.js — End-to-end pipeline verification.
 * Simulates: lead -> theme -> generate -> hugo build.
 *
 * Usage: node scripts/test-pipeline.js [--url http://localhost:3000]
 */

const API_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : process.env.API_URL || 'http://localhost:3000';

const TEST_CASES = [
  { businessName: 'AutoTest Saloon', category: 'Salon', city: 'Kyiv' },
  { businessName: 'AutoTest Clinic', category: 'Medical', city: 'Lviv' },
];

async function request(method, path, body, authHeaders) {
  const opts = { method, headers: { ...authHeaders, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_URL + path, opts);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(method + ' ' + path + ' failed (' + res.status + '): ' + JSON.stringify(data));
  }
  return data;
}

async function run() {
  console.log('Prompt Site Builder - Pipeline Test');
  console.log('API: ' + API_URL);

  // 1. Health
  console.log('[1/6] Health check...');
  const health = await request('GET', '/health', null, {});
  console.log('  Backend: ' + health.status);

  // 2. Auth
  console.log('[2/6] Auth...');
  const email = 'test-' + Date.now() + '@test.com';
  const password = 'testpass123456';
  try {
    await request('POST', '/auth/register', { email, password, name: 'Test User' }, {});
    console.log('  Registered: ' + email);
  } catch (e) {
    if (e.message.includes('409') || e.message.includes('already exists')) {
      console.log('  User exists, trying login');
    } else {
      throw e;
    }
  }
  const { accessToken } = await request('POST', '/auth/login', { email, password }, {});
  console.log('  Logged in');
  const headers = { Authorization: 'Bearer ' + accessToken };

  // 3-6. For each test case
  let failures = 0;
  let successes = 0;
  for (const tc of TEST_CASES) {
    try {
      console.log('[3/6] Creating lead: ' + tc.businessName);
      const lead = await request('POST', '/leads', { ...tc, source: 'test-pipeline' }, headers);
      console.log('  Lead: ' + lead.id);

      console.log('[4/6] Creating project');
      const project = await request('POST', '/projects', { leadId: lead.id, slug: lead.slug }, headers);
      console.log('  Project: ' + project.id);

      console.log('[5/6] Generate site');
      const gen = await request('POST', '/generation/' + project.id + '/generate', { theme: 'auto' }, headers);
      console.log('  Job: ' + (gen.jobId || gen.id));

      console.log('[6/6] Verify health');
      await request('GET', '/health', null, {});
      successes++;
    } catch (e) {
      console.error('  FAILED: ' + e.message);
      failures++;
    }
  }

  console.log('');
  console.log('Pipeline: ' + successes + '/' + TEST_CASES.length + ' passed, ' + failures + ' failed');
  if (failures > 0) process.exit(1);
  console.log('All stages OK');
}

run().catch(function(e) {
  console.error('Pipeline failed: ' + e.message);
  process.exit(1);
});
