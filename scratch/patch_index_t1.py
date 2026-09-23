import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
INDEX_JS = BASE_DIR / "src" / "index.js"

with open(INDEX_JS, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add import
if "import { dealQuality } from './dealQuality.js';" not in content:
    content = content.replace(
        "import { getEntitlements } from './rewards.js';",
        "import { getEntitlements } from './rewards.js';\nimport { dealQuality } from './dealQuality.js';"
    )

# 2. Add applyDealQualityFilter function
helper = """
async function applyDealQualityFilter(env, ctx, filtered) {
  const now = new Date();
  const apply = async (arr) => {
    const valid = [];
    for (const deal of (arr || [])) {
      const obs = deal.observations || (deal.price_history ? deal.price_history.map(p => ({price: p, date: new Date().toISOString()})) : []);
      const dq = dealQuality(obs, deal, now);
      if (dq.eligible) {
        deal.basis_text = dq.basis_text || deal.basis_text;
        deal.pct_below_avg = dq.pct_below_avg || deal.pct_below_avg;
        valid.push(deal);
      } else {
        const promise = logEvent(env, {
          event_type: 'deal_suppressed',
          origin: deal.origin,
          route: deal.display_name,
          meta: { price: deal.price, reasons: dq.reasons }
        });
        if (ctx && ctx.waitUntil) ctx.waitUntil(promise);
        else await promise;
      }
    }
    return valid;
  };
  
  filtered.deals = await apply(filtered.deals);
  filtered.featured = await apply(filtered.featured);
  return filtered;
}
"""
if "async function applyDealQualityFilter" not in content:
    content = content.replace(
        "function filterDealsByOrigin(combined, origin) {",
        helper + "\nfunction filterDealsByOrigin(combined, origin) {"
    )

# 3. Patch GET /api/deals
api_deals_orig = """    return jsonResponse(200, {
      ok: true,
      tier,
      origin,
      generated_at: combined.generated_at || null,
      ...filterDealsByOrigin(combined, origin),
    });"""

api_deals_new = """    const filtered = filterDealsByOrigin(combined, origin);
    const checked = await applyDealQualityFilter(env, ctx, filtered);

    return jsonResponse(200, {
      ok: true,
      tier,
      origin,
      generated_at: combined.generated_at || null,
      ...checked,
    });"""

if api_deals_orig in content:
    content = content.replace(api_deals_orig, api_deals_new)

# 4. Patch sendDailyAlerts
send_orig = """      const filtered = filterDealsByOrigin(fileCache.get(filename), user.origin_iata);
      const deals = [
        ...(filtered.deals || []),
        ...(filtered.featured || []),
      ];

      if (earlyOnly) {"""

send_new = """      let filtered = filterDealsByOrigin(fileCache.get(filename), user.origin_iata);
      filtered = await applyDealQualityFilter(env, null, filtered);
      const deals = [
        ...(filtered.deals || []),
        ...(filtered.featured || []),
      ];

      if (deals.length === 0) {
        skipped += 1;
        continue;
      }

      if (earlyOnly) {"""

if send_orig in content:
    content = content.replace(send_orig, send_new)


with open(INDEX_JS, "w", encoding="utf-8") as f:
    f.write(content)

print("index.js patched successfully.")
