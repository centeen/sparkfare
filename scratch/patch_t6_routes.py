import sys
with open(r'c:\Users\cente\sparkfare\src\index.js', 'r', encoding='utf-8') as f:
    content = f.read()

new_routes = """
    // T6: Embeddable Widget Generator
    if (url.pathname === '/embed') {
      const html = await loadHtmlAsset(env, 'embed.html');
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // T6: Widget Embed UI
    if (url.pathname === '/widget') {
      const html = await loadHtmlAsset(env, 'widget.html');
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // T6: Widget API Endpoint
    if (url.pathname.startsWith('/api/widget/')) {
      const parts = url.pathname.split('/');
      if (parts.length === 5) {
        const origin = parts[3].toUpperCase();
        const dest = decodeURIComponent(parts[4]).toUpperCase();
        
        if (VALID_ORIGINS.has(origin)) {
          // IP Rate Limiting (100 requests per hour per origin per IP)
          const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
          const nowSeconds = Math.floor(Date.now() / 1000);
          const windowStart = nowSeconds - 3600; // 1 hour window
          
          if (env.DB) {
            try {
              // Purge old limits
              await env.DB.prepare('DELETE FROM widget_rate_limits WHERE window_start < ?').bind(windowStart).run();
              
              const record = await env.DB.prepare('SELECT request_count FROM widget_rate_limits WHERE ip_hash = ? AND origin = ?').bind(ip, origin).first();
              
              if (record && record.request_count >= 100) {
                return new Response('Rate limit exceeded', { status: 429 });
              }
              
              await env.DB.prepare(`
                INSERT INTO widget_rate_limits (ip_hash, origin, request_count, window_start)
                VALUES (?, ?, 1, ?)
                ON CONFLICT(ip_hash, origin) DO UPDATE SET request_count = request_count + 1
              `).bind(ip, origin, nowSeconds).run();
            } catch (e) {
              console.error('Rate limiting error:', e);
            }
          }

          const raw = await loadJsonAsset(env, `sparkfare_ranked_deals${origin === 'JFK' ? '' : '_other_origins'}.json`);
          const dealList = raw.deals || [];
          let targetDeal = null;
          
          for (const d of dealList) {
            if (d.origin === origin && d.destination.toUpperCase() === dest) {
              targetDeal = d;
              break;
            }
          }
          if (!targetDeal && raw.featured) {
            for (const d of raw.featured) {
              if (d.origin === origin && d.destination.toUpperCase() === dest) {
                targetDeal = d;
                break;
              }
            }
          }

          if (targetDeal) {
            const now = new Date();
            const obs = targetDeal.observations || (targetDeal.price_history ? targetDeal.price_history.map(p => ({price: p, date: now.toISOString()})) : []);
            const { dealQuality } = await import('./dealQuality.js');
            const dq = dealQuality(obs, targetDeal, now);
            
            if (dq.eligible) {
              targetDeal.basis_text = dq.basis_text;
              return jsonResponse(200, { ok: true, deal: targetDeal }, { 'Cache-Control': 'public, max-age=3600' });
            } else {
              return jsonResponse(404, { ok: false, error: 'Deal not currently eligible' });
            }
          } else {
            return jsonResponse(404, { ok: false, error: 'Deal not found' });
          }
        }
      }
      return jsonResponse(400, { ok: false, error: 'Invalid origin or destination' });
    }
"""

content = content.replace("    return handleRequest(request, env, ctx);", new_routes + "\n    return handleRequest(request, env, ctx);")

with open(r'c:\Users\cente\sparkfare\src\index.js', 'w', encoding='utf-8') as f:
    f.write(content)
