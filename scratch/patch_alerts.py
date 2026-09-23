import os

file_path = r'C:\Users\cente\sparkfare\src\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. sendDailyAlerts
target_daily = """  const users = await env.DB.prepare(earlyOnly
    ? `SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1 AND early_access = 1`
    : `SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1`
  ).all();"""
replacement_daily = """  const isMonday = new Date().getUTCDay() === 1;
  const freqCheck = `(frequency = 'daily' OR frequency = 'instant' ${isMonday ? "OR frequency = 'weekly'" : ""})`;
  const pauseCheck = `(paused_until IS NULL OR datetime(paused_until) < datetime('now'))`;
  
  const users = await env.DB.prepare(earlyOnly
    ? `SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1 AND early_access = 1 AND ${pauseCheck} AND ${freqCheck}`
    : `SELECT id, email, origin_iata FROM users WHERE verified_email = 1 AND unsubscribed_at IS NULL AND is_subscribed = 1 AND ${pauseCheck} AND ${freqCheck}`
  ).all();"""

if target_daily in content:
    content = content.replace(target_daily, replacement_daily)
    print("Patched sendDailyAlerts")
else:
    print("Could not find target_daily")

# 2. Other alerts (trips)
# sendStressValveAlerts
target_trips = "WHERE users.unsubscribed_at IS NULL"
replacement_trips = "WHERE users.unsubscribed_at IS NULL AND (users.paused_until IS NULL OR datetime(users.paused_until) < datetime('now'))"

count = content.count(target_trips)
content = content.replace(target_trips, replacement_trips)
print(f"Patched {count} trip alerts")

# 3. trigger-newsletter
target_admin = "`SELECT id, email FROM users WHERE origin_iata = ? AND unsubscribed_at IS NULL`"
replacement_admin = "`SELECT id, email FROM users WHERE origin_iata = ? AND unsubscribed_at IS NULL AND (paused_until IS NULL OR datetime(paused_until) < datetime('now'))`"
if target_admin in content:
    content = content.replace(target_admin, replacement_admin)
    print("Patched trigger-newsletter")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
