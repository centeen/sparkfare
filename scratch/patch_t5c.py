import os

file_path = r'C:\Users\cente\sparkfare\src\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add checkAndLogRoutePromotions function
func = """
async function checkAndLogRoutePromotions(env) {
  const { dealQuality } = await import('./dealQuality.js');
  
  // Get already promoted routes
  const existing = await env.DB.prepare("SELECT route FROM events WHERE event_type = 'route_promoted'").all();
  const promotedSet = new Set(existing.results.map(r => r.route));
  
  const origins = Array.from(VALID_ORIGINS);
  const now = new Date();
  let newCount = 0;
  
  for (const origin of origins) {
    const raw = await loadJsonAsset(env, `sparkfare_ranked_deals${origin === 'JFK' ? '' : '_other_origins'}.json`);
    const allDeals = [...(raw.deals || []), ...(raw.featured || [])].filter(d => d.origin === origin);
    
    for (const deal of allDeals) {
      const obs = deal.observations || (deal.price_history ? deal.price_history.map(p => ({price: p, date: now.toISOString()})) : []);
      const dq = dealQuality(obs, deal, now);
      
      if (dq.spanDays >= 14 && dq.baselineN >= 10) {
        const routeKey = `${origin}-${deal.destination}`;
        if (!promotedSet.has(routeKey)) {
          // Log new promotion
          await env.DB.prepare(`
            INSERT INTO events (id, event_type, route, origin)
            VALUES (?, 'route_promoted', ?, ?)
          `).bind(crypto.randomUUID(), routeKey, origin).run();
          
          promotedSet.add(routeKey);
          console.log(`Promoted route to indexable: ${routeKey}`);
          newCount++;
        }
      }
    }
  }
  return newCount;
}
"""

if "checkAndLogRoutePromotions" not in content:
    target = "export default {"
    content = content.replace(target, func + "\n" + target)

# 2. Add to scheduled
scheduled_target = """    try {
      await sendRouteRetrospectives(env);
    } catch (error) {
      console.error('Scheduled route retrospectives failed:', error);
    }"""
scheduled_repl = scheduled_target + """
    try {
      await checkAndLogRoutePromotions(env);
    } catch (error) {
      console.error('Scheduled route promotion check failed:', error);
    }"""

if "await checkAndLogRoutePromotions(env);" not in content:
    content = content.replace(scheduled_target, scheduled_repl)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched index.js for T5c")
