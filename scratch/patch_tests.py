import os

test_file = r'c:\Users\cente\sparkfare\tests\phase10.test.js'
with open(test_file, 'r', encoding='utf-8') as f:
    content = f.read()

new_tests = """
test('preferences endpoint accepts away_needs valid array', async () => {
  const request = new Request('http://localhost/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-test-token' },
    body: JSON.stringify({ away_needs: '["pet","insurance"]' }),
  });
  
  // Set up mock DB
  let dbUpdates = [];
  const env = {
    CLERK_SECRET_KEY: 'configured',
    DB: {
      prepare: (query) => ({
        run: () => { if(query.includes('ALTER')) return Promise.resolve(); },
        bind: (...args) => ({
          run: () => { dbUpdates.push({ query, args }); return Promise.resolve(); }
        })
      })
    }
  };

  const response = await handleRequest(request, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.updated.away_needs, '["pet","insurance"]');
});

test('preferences endpoint drops invalid away_needs keys', async () => {
  const request = new Request('http://localhost/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer valid-test-token' },
    body: JSON.stringify({ away_needs: '["pet","invalid_key","bags"]' }),
  });
  
  // Set up mock DB
  let dbUpdates = [];
  const env = {
    CLERK_SECRET_KEY: 'configured',
    DB: {
      prepare: (query) => ({
        run: () => { if(query.includes('ALTER')) return Promise.resolve(); },
        bind: (...args) => ({
          run: () => { dbUpdates.push({ query, args }); return Promise.resolve(); }
        })
      })
    }
  };

  const response = await handleRequest(request, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.updated.away_needs, '["pet","bags"]');
});
"""

target = "  assert.match(body.error, /authenticated/i);\n});"
replacement = target + "\n" + new_tests
content = content.replace(target, replacement)

with open(test_file, 'w', encoding='utf-8') as f:
    f.write(content)
