import os

file_path = r'C:\Users\cente\sparkfare\tests\t2b_sequence.test.js'
content = """import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendPreDepartureSequenceAlerts } from '../src/index.js';
import * as email from '../src/email.js';

describe('T2b Automated pre-departure Away Mode sequence', () => {
  let env;
  let mockDb;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z')); // "now"

    mockDb = {
      prepare: vi.fn(),
    };
    env = {
      DB: mockDb,
      ENABLE_T2B_SEQUENCE: 'true',
    };

    // Default mock returns
    mockDb.prepare.mockImplementation((query) => {
      const bind = vi.fn().mockReturnThis();
      const all = vi.fn().mockResolvedValue({ results: [] });
      const first = vi.fn().mockResolvedValue(null);
      const run = vi.fn().mockResolvedValue({ success: true });
      return { bind, all, first, run };
    });

    vi.spyOn(email, 'sendPreDepartureSequenceEmail').mockResolvedValue({ ok: true, partner_slug: 'bounce' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('skips if ENABLE_T2B_SEQUENCE is not true', async () => {
    env.ENABLE_T2B_SEQUENCE = 'false';
    const result = await sendPreDepartureSequenceAlerts(env);
    expect(result.reason).toBe('T2b sequence flag disabled');
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('fires exactly at day 14, 7, and 1 offsets', async () => {
    mockDb.prepare.mockImplementation((query) => {
      const self = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      if (query.includes('FROM trips')) {
        self.all.mockResolvedValue({
          results: [
            { trip_id: 't_14', email: 'a@test.com', departure_at: '2026-10-15T12:00:00Z' }, // 14 days
            { trip_id: 't_7', email: 'b@test.com', departure_at: '2026-10-08T12:00:00Z' }, // 7 days
            { trip_id: 't_1', email: 'c@test.com', departure_at: '2026-10-02T12:00:00Z' }, // 1 day
            { trip_id: 't_2', email: 'd@test.com', departure_at: '2026-10-03T12:00:00Z' }, // 2 days (should skip)
          ]
        });
      }
      return self;
    });

    const result = await sendPreDepartureSequenceAlerts(env);
    expect(result.sent).toBe(3);
    expect(result.skipped).toBe(1); // t_2 skipped

    expect(email.sendPreDepartureSequenceEmail).toHaveBeenCalledTimes(3);
    // Verify arguments for day 14
    expect(email.sendPreDepartureSequenceEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@test.com', daysUntil: 14 }),
      env
    );
  });

  it('does not double-fire for the same stage', async () => {
    mockDb.prepare.mockImplementation((query) => {
      const self = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      if (query.includes('FROM trips')) {
        self.all.mockResolvedValue({
          results: [
            { trip_id: 't_14', email: 'a@test.com', departure_at: '2026-10-15T12:00:00Z' }
          ]
        });
      }
      if (query.includes('SELECT status FROM pre_departure_sequence_deliveries')) {
        self.first.mockResolvedValue({ status: 'sent' }); // simulate already sent
      }
      return self;
    });

    const result = await sendPreDepartureSequenceAlerts(env);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(email.sendPreDepartureSequenceEmail).not.toHaveBeenCalled();
  });

  it('fetches excluded partners from away_mode_email_log and passes them correctly', async () => {
    mockDb.prepare.mockImplementation((query) => {
      const self = {
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      if (query.includes('FROM trips')) {
        self.all.mockResolvedValue({
          results: [
            { trip_id: 't_7', email: 'a@test.com', departure_at: '2026-10-08T12:00:00Z' }
          ]
        });
      }
      if (query.includes('away_mode_email_log')) {
        self.all.mockResolvedValue({
          results: [
            { partner_id: 'bounce' },
            { partner_id: 'safetywing' }
          ]
        });
      }
      return self;
    });

    const result = await sendPreDepartureSequenceAlerts(env);
    expect(result.sent).toBe(1);

    expect(email.sendPreDepartureSequenceEmail).toHaveBeenCalledWith(
      expect.objectContaining({ excludedPartnerIds: ['bounce', 'safetywing'] }),
      env
    );
  });
});
"""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Created t2b_sequence.test.js")
