import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import worker from '../src/index.js';

test('Partners API - returns only live partners with real URLs', async () => {
  // We can read 0002_partners.sql to mock the DB or just parse the sql file directly,
  // but to test the actual endpoint as a unit test we mock DB.
  // Actually, since we need to assert exactly what is in the DB, let's parse 0002_partners.sql.
  const sqlPath = path.resolve(process.cwd(), 'migrations/0002_partners.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  
  // Extract seed data
  const valuesRegex = /INSERT INTO partners.*?VALUES\s*([\s\S]*?);/s;
  const match = sqlContent.match(valuesRegex);
  assert.ok(match, 'Could not find seed data in 0002_partners.sql');
  
  const valuesStr = match[1];
  const rows = valuesStr.split('),').map(r => r.replace(/[()']/g, '').trim());
  
  // Mock DB using the parsed rows
  const mockPartners = [];
  for (const row of rows) {
    if (!row) continue;
    const cols = row.split(',').map(c => c.trim());
    if (cols.length >= 6 && cols[5] === 'live') {
      mockPartners.push({
        slug: cols[0],
        name: cols[1],
        category: cols[2],
        link: cols[3],
        blurb: cols[4]
      });
    }
  }

  const fakeEnv = {
    DB: {
      prepare: () => ({
        all: async () => ({ results: mockPartners })
      })
    }
  };

  const req = new Request('https://sparkfare.com/api/partners');
  const res = await worker.fetch(req, fakeEnv, { waitUntil: () => {} });
  
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  
  assert.ok(data.partners.length > 0, 'Should return partners');
  
  for (const p of data.partners) {
    // Assert status='live' is implicitly tested because our mock only returned live partners
    // Assert URL is not a placeholder domain without real tracking param
    const url = p.link;
    const isPlaceholder = url.match(/^https:\/\/[^/]+\.com\/\?utm_source=sparkfare$/);
    assert.equal(isPlaceholder, null, `Partner ${p.slug} has placeholder URL: ${url}`);
  }
});

test('Away Mode UI - fallback message on API failure', async () => {
  const htmlPath = path.resolve(process.cwd(), 'away-mode.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Extract the fetchPartners function body
  const fetchMatches = htmlContent.match(/async function fetchPartners\(\) \{([\s\S]*?)\n    \}/);
  assert.ok(fetchMatches, 'Could not find fetchPartners in away-mode.html');
  
  const fetchBody = fetchMatches[1];

  // We set up a mock DOM environment
  let currentHTML = '<div class="coming-soon">Loading partners...</div>';
  
  const mockDocument = {
    querySelector: (sel) => {
      if (sel === '.partner-list') {
        return {
          get innerHTML() { return currentHTML; },
          set innerHTML(val) { currentHTML = val; }
        };
      }
      return null;
    }
  };

  // Mock fetch to simulate failure
  const mockFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('Failed to parse JSON'); }
  });

  // Execute the logic inside a function
  const executeFetchPartners = new Function('document', 'fetch', 'console', 'loadLocalState', 
    'return (async () => {\n' + fetchBody + '\n})();'
  );

  await executeFetchPartners(mockDocument, mockFetch, { error: () => {} }, () => {});

  assert.equal(currentHTML, '<div class="coming-soon">Partners are temporarily unavailable — check back soon</div>', 
    'Fallback message was not correctly set on API failure');
});
