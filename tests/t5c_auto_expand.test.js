import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('T5c Auto-expanding route content', async () => {
  const eventsLogged = [];
  let existingEvents = [];

  const fakeEnv = {
    ASSETS: {
      fetch: async (req) => {
        const url = req.url;
        if (url.includes('sparkfare_ranked_deals')) {
          return {
            ok: true,
            json: async () => ({
              deals: [
                {
                  origin: 'JFK',
                  display_name: 'CDG', // Rich route
                  price: 350,
                  observations: Array(15).fill(0).map((_, i) => ({
                    price: 350 + (14 - i) * 5,
                    date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString()
                  }))
                },
                {
                  origin: 'JFK',
                  display_name: 'LHR', // Thin route
                  price: 400,
                  observations: Array(3).fill(0).map((_, i) => ({
                    price: 400 + (2 - i) * 5,
                    date: new Date(Date.now() - (2 - i) * 24 * 60 * 60 * 1000).toISOString()
                  }))
                }
              ]
            })
          };
        }
        return { ok: true, json: async () => ({ deals: [] }) };
      }
    },
    DB: {
      prepare: (sql) => {
        return {
          run: async () => {},  // for prepare(sql).run() (no bind)
          all: async () => ({ results: existingEvents }),
          first: async () => null,
          bind: (...args) => ({
            run: async () => {
              if (sql.includes('INSERT INTO events')) {
                eventsLogged.push(args[1]); // route
              }
            },
            first: async () => null,
            all: async () => ({ results: [] }),
          }),
        };
      }
    }
  };

  // Run scheduled event
  await worker.scheduled({ cron: '0 0 * * *' }, fakeEnv);

  // JFK-CDG should be logged as promoted. LHR should not.
  assert.equal(eventsLogged.length, 1);
  assert.equal(eventsLogged[0], 'JFK-CDG');

  // Run again with it already in the database
  existingEvents = [{ route: 'JFK-CDG' }];
  eventsLogged.length = 0; // clear array
  await worker.scheduled({ cron: '0 0 * * *' }, fakeEnv);

  // Should not log again
  assert.equal(eventsLogged.length, 0);
});
