import 'dotenv/config';
import { sendVerificationEmail, sendDailyDealEmail } from './email.js';

const VALID_ORIGINS = new Set([
  'JFK','LAX','ORD','ATL','DFW','SFO','MIA','IAD','EWR','SEA','IAH','BOS'
]);

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withTripMarker(bookingLink, tripId) {
  const url = new URL(bookingLink);
  if (url.hostname !== 'www.aviasales.com') throw new Error('Invalid booking link');
  url.searchParams.set('marker', `314524.${tripId}`);
  return url.toString();
}

async function loadRankedDeals(env) {
  if (!env?.ASSETS) return {};
  const response = await env.ASSETS.fetch(new Request('https://sparkfare.local/sparkfare_ranked_deals.json'));
  if (!response.ok) return {};
  return response.json();
}

export async function sendDailyAlerts(env) {
  if (!env?.DB) return { sent: 0, skipped: 0, reason: 'DB not configured' };

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS daily_alert_deliveries (
      delivery_key TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      delivered_on TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  const users = await env.DB.prepare(`
    SELECT email, origin_iata
    FROM users
    WHERE verified_email = 1 AND unsubscribed_at IS NULL
  `).all();
  const ranked = await loadRankedDeals(env);
  const deals = [
    ...(ranked.deals || []),
    ...(ranked.featured || []),
  ];
  let sent = 0;
  let skipped = 0;
  const deliveredOn = new Date().toISOString().slice(0, 10);

  for (const user of users.results || []) {
    const deliveryKey = `${user.email}:${deliveredOn}`;
    const alreadySent = await env.DB.prepare(
      'SELECT status FROM daily_alert_deliveries WHERE delivery_key = ? AND status = ?'
    ).bind(deliveryKey, 'sent').first();
    if (alreadySent) {
      skipped += 1;
      continue;
    }

    await env.DB.prepare(`
      INSERT OR REPLACE INTO daily_alert_deliveries
        (delivery_key, email, delivered_on, status, error)
      VALUES (?, ?, ?, 'pending', NULL)
    `).bind(deliveryKey, user.email, deliveredOn).run();

    try {
      const result = await sendDailyDealEmail({
        email: user.email,
        origin: user.origin_iata,
        deals,
      }, env);
      if (result.ok) {
        await env.DB.prepare(
          'UPDATE daily_alert_deliveries SET status = ?, error = NULL WHERE delivery_key = ?'
        ).bind('sent', deliveryKey).run();
        sent += 1;
      }
    } catch (error) {
      console.error(`Daily alert failed for ${user.email}:`, error);
      await env.DB.prepare(
        'UPDATE daily_alert_deliveries SET status = ?, error = ? WHERE delivery_key = ?'
      ).bind('failed', error.message, deliveryKey).run();
    }
  }

  return { sent, skipped };
}

async function getClerkSession(request, env) {
  if (!env?.CLERK_SECRET_KEY) {
    return { configured: false, authenticated: false, user: null };
  }

  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return { configured: true, authenticated: false, user: null };
    }

    const { verifyToken } = await import('@clerk/backend');
    const payload = await verifyToken({
      token,
      secretKey: env.CLERK_SECRET_KEY,
    });

    return {
      configured: true,
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email || null,
      },
    };
  } catch (error) {
    return {
      configured: true,
      authenticated: false,
      user: null,
      error: error.message,
    };
  }
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/api/trips' && request.method === 'POST') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) return jsonResponse(401, { ok: false, error: 'Not authenticated' });

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { destination, origin_iata, departure_at, return_at, price_at_click, booking_link } = body;
    if (!destination || !origin_iata || !departure_at || price_at_click == null || !booking_link) {
      return jsonResponse(400, { ok: false, error: 'Missing trip fields' });
    }
    if (!VALID_ORIGINS.has(String(origin_iata).toUpperCase())) {
      return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
    }

    const tripId = crypto.randomUUID();
    try {
      const trackedBookingLink = withTripMarker(booking_link, tripId);
      if (env?.DB) {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS trips (
            trip_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            destination TEXT NOT NULL,
            origin_iata TEXT NOT NULL,
            departure_at TEXT NOT NULL,
            return_at TEXT,
            price_at_click INTEGER NOT NULL,
            clicked_at TEXT DEFAULT (datetime('now')),
            status TEXT DEFAULT 'clicked'
          )
        `).run();
        const result = await env.DB.prepare(`
          INSERT INTO trips
            (trip_id, user_id, destination, origin_iata, departure_at, return_at, price_at_click)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          tripId,
          session.user.id,
          destination,
          String(origin_iata).toUpperCase(),
          departure_at,
          return_at || null,
          Number(price_at_click)
        ).run();
        if (!result || result.success === false) throw new Error('Trip insert failed');
      }

      return jsonResponse(200, {
        ok: true,
        trip_id: tripId,
        redirect_url: `/departing/${tripId}?url=${encodeURIComponent(trackedBookingLink)}`,
      });
    } catch (error) {
      console.error('Trip tracking failed:', error);
      return jsonResponse(400, { ok: false, error: error.message || 'Unable to track trip' });
    }
  }

  if (url.pathname === '/api/signup' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    try {
      const { id, email, origin_iata, pet_owner, trip_length, subscription_tier } = body;
      const session = await getClerkSession(request, env);
      const userId = session.authenticated ? session.user.id : id;
      const userEmail = session.authenticated ? session.user.email || email : email;

      if (!userId || !userEmail || !origin_iata || !trip_length) {
        return jsonResponse(400, { ok: false, error: 'Missing required fields' });
      }

      if (!VALID_ORIGINS.has(origin_iata.toUpperCase())) {
        return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
      }

      const safeTier = subscription_tier || 'free';
      const verifiedEmail = session.authenticated ? 1 : 0;
      let storedId = userId;

      if (env?.DB) {
        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(userEmail).first();
        const result = existing
          ? await env.DB.prepare(`
              UPDATE users
              SET origin_iata = ?, pet_owner = ?, trip_length = ?, subscription_tier = ?, unsubscribed_at = NULL
              WHERE email = ?
            `).bind(
              origin_iata.toUpperCase(),
              pet_owner ?? 0,
              trip_length,
              safeTier,
              userEmail
            ).run()
          : await env.DB.prepare(`
              INSERT INTO users (
                id, email, verified_email, origin_iata, pet_owner, trip_length, subscription_tier
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
              userId,
              userEmail,
              verifiedEmail,
              origin_iata.toUpperCase(),
              pet_owner ?? 0,
              trip_length,
              safeTier
            ).run();

        storedId = existing?.id || userId;

        if (!result || result.success === false) {
          return jsonResponse(500, { ok: false, error: 'Unable to save your alert right now' });
        }
      }

      return jsonResponse(200, {
        ok: true,
        user: {
          id: storedId,
          email: userEmail,
          origin_iata: origin_iata.toUpperCase(),
          pet_owner: pet_owner ?? 0,
          trip_length,
          subscription_tier: safeTier,
        },
      });
    } catch (error) {
      console.error('Signup storage failed:', error);
      return jsonResponse(500, { ok: false, error: 'Unable to save your alert right now' });
    }
  }

  if (url.pathname === '/api/session' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.configured) {
      return jsonResponse(200, {
        ok: true,
        configured: false,
        authenticated: false,
        message: 'Clerk secret key not configured yet.',
      });
    }

    return jsonResponse(session.authenticated ? 200 : 401, {
      ok: session.authenticated,
      configured: true,
      authenticated: session.authenticated,
      user: session.user,
    });
  }

  if (url.pathname === '/api/account' && request.method === 'GET') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) {
      return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    }

    return jsonResponse(200, {
      ok: true,
      user: session.user,
      account_status: 'active',
      subscription_tier: 'free',
    });
  }

  if (url.pathname === '/api/preferences' && request.method === 'POST') {
    const session = await getClerkSession(request, env);
    if (!session.authenticated) {
      return jsonResponse(401, { ok: false, error: 'Not authenticated' });
    }

    try {
      const body = await request.json();
      const { origin_iata, pet_owner, trip_length } = body;

      if (origin_iata && !VALID_ORIGINS.has(origin_iata.toUpperCase())) {
        return jsonResponse(400, { ok: false, error: 'Invalid origin_iata value' });
      }

      return jsonResponse(200, {
        ok: true,
        user_id: session.user.id,
        updated: {
          origin_iata: origin_iata ? origin_iata.toUpperCase() : null,
          pet_owner: pet_owner ?? null,
          trip_length: trip_length ?? null,
        },
      });
    } catch (error) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
    }
  }

  if (url.pathname === '/api/verify' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        return jsonResponse(400, { ok: false, error: 'Email is required' });
      }

      if (env?.DB) {
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (!user) {
          return jsonResponse(404, { ok: false, error: 'User not found' });
        }

        const result = await env.DB.prepare('UPDATE users SET verified_email = 1 WHERE email = ?').bind(email).run();
        if (!result || result.success === false) {
          return jsonResponse(500, { ok: false, error: 'Failed to verify user' });
        }
      }

      const verificationUrl = `${env.APP_URL || 'https://sparkfare.com'}/account`;
      await sendVerificationEmail({
        email,
        verificationUrl,
      }, env);

      return jsonResponse(200, { ok: true, verified_email: 1, email });
    } catch (error) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
    }
  }

  if (url.pathname === '/api/send-daily-alert' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { email, origin, deals } = body;

      if (!email || !origin) {
        return jsonResponse(400, { ok: false, error: 'Email and origin are required' });
      }

      const result = await sendDailyDealEmail({ email, origin, deals: deals || [] }, env);
      return jsonResponse(200, {
        ok: true,
        sent: true,
        mocked: result.mocked || false,
      });
    } catch (error) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
    }
  }

  if (url.pathname === '/api/unsubscribe' && request.method === 'GET') {
    const email = url.searchParams.get('email');
    if (!email) return new Response('Email is required', { status: 400 });

    if (env?.DB) {
      const result = await env.DB.prepare(
        'UPDATE users SET unsubscribed_at = datetime("now") WHERE email = ?'
      ).bind(email).run();
      if (!result || result.success === false) {
        return new Response('Unable to unsubscribe right now', { status: 500 });
      }
    }

    return new Response('You have been unsubscribed from Sparkfare daily deal emails.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (url.pathname === '/api/unsubscribe' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email) {
        return jsonResponse(400, { ok: false, error: 'Email is required' });
      }

      if (env?.DB) {
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
        if (!user) {
          return jsonResponse(404, { ok: false, error: 'User not found' });
        }

        const result = await env.DB.prepare('UPDATE users SET unsubscribed_at = datetime("now") WHERE email = ?').bind(email).run();
        if (!result || result.success === false) {
          return jsonResponse(500, { ok: false, error: 'Failed to unsubscribe user' });
        }
      }

      return jsonResponse(200, { ok: true, unsubscribed: true, email });
    } catch (error) {
      return jsonResponse(400, { ok: false, error: 'Invalid JSON body' });
    }
  }

  if (url.pathname === '/api/health') {
    return jsonResponse(200, { ok: true, status: 'healthy' });
  }

  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/departing/')) {
      return new Response(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Taking you to your fare | Sparkfare</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#E8DCC5;color:#2E2318;font:16px 'Segoe UI',sans-serif}main{width:min(100%,520px);padding:32px;background:#FAF6EE;border:1px solid #D9CBB0;border-radius:8px;text-align:center}h1{font-size:1.8rem}p{color:#6B5A45}.teaser{margin-top:20px;padding-top:20px;border-top:1px dashed #D9CBB0;font-size:.9rem}a{color:#B8720F}</style></head><body><main><h1>Taking you to your fare</h1><p>One moment while we open the booking page.</p><p class="teaser">While you are away, Sparkfare can help you handle travel coverage, home and pet care, and connectivity before departure.</p><p id="fallback" hidden><a id="continue" href="">Continue to booking</a></p></main><script>const target=new URLSearchParams(location.search).get('url'),fallback=document.getElementById('fallback'),link=document.getElementById('continue');if(target){link.href=target;fallback.hidden=false;setTimeout(()=>location.replace(target),700)}else{fallback.hidden=false;link.href='/';link.textContent='Return to Sparkfare'}</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return handleRequest(request, env);
  },
  async scheduled(_event, env) {
    await sendDailyAlerts(env);
  },
};
