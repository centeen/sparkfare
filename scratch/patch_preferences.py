import os

file_path = r'C:\Users\cente\sparkfare\src\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Patch GET /api/account
target_account = "const user = await env.DB.prepare('SELECT origin_iata, passenger_count, trip_length, has_pet FROM users WHERE id = ?').bind(session.user.id).first();"
replacement_account = "const user = await env.DB.prepare('SELECT origin_iata, passenger_count, trip_length, has_pet, frequency, paused_until FROM users WHERE id = ?').bind(session.user.id).first();"

if target_account in content:
    content = content.replace(target_account, replacement_account)
    print("Account GET patched")

# Patch POST /api/preferences destructuring
target_destruct = "const { origin_iata, passenger_count, trip_length, has_pet, away_needs } = body;"
replacement_destruct = "const { origin_iata, passenger_count, trip_length, has_pet, away_needs, frequency, paused_until } = body;"

if target_destruct in content:
    content = content.replace(target_destruct, replacement_destruct)
    print("Preferences POST destructuring patched")

# Patch POST /api/preferences SQL update
target_sql = """      if (env?.DB) {
        try { await env.DB.prepare('ALTER TABLE users ADD COLUMN has_pet BOOLEAN DEFAULT 0').run(); } catch(e) {}
        await env.DB.prepare(`
          UPDATE users SET
            origin_iata = COALESCE(?, origin_iata),
            passenger_count = COALESCE(?, passenger_count),
            trip_length = COALESCE(?, trip_length),
            has_pet = COALESCE(?, has_pet),
            away_needs = COALESCE(?, away_needs)
          WHERE id = ?
        `).bind(updatedOrigin, safePassengerCount, trip_length ?? null, has_pet ?? null, safeAwayNeeds ?? null, session.user.id).run();
      }

      return jsonResponse(200, {
        ok: true,
        user_id: session.user.id,
        updated: {
          origin_iata: updatedOrigin,
          passenger_count: safePassengerCount,
          trip_length: trip_length ?? null,
          has_pet: has_pet ?? null,
          away_needs: safeAwayNeeds ?? null,
        },
      });"""

replacement_sql = """      if (env?.DB) {
        try { await env.DB.prepare('ALTER TABLE users ADD COLUMN has_pet BOOLEAN DEFAULT 0').run(); } catch(e) {}
        
        let updateQuery = `
          UPDATE users SET
            origin_iata = COALESCE(?, origin_iata),
            passenger_count = COALESCE(?, passenger_count),
            trip_length = COALESCE(?, trip_length),
            has_pet = COALESCE(?, has_pet),
            away_needs = COALESCE(?, away_needs),
            frequency = COALESCE(?, frequency)
        `;
        const binds = [updatedOrigin, safePassengerCount, trip_length ?? null, has_pet ?? null, safeAwayNeeds ?? null, frequency ?? null];
        
        if (paused_until !== undefined) {
          updateQuery += `, paused_until = ?`;
          binds.push(paused_until === 'null' || paused_until === null ? null : paused_until);
        }
        
        updateQuery += ` WHERE id = ?`;
        binds.push(session.user.id);

        await env.DB.prepare(updateQuery).bind(...binds).run();
      }

      return jsonResponse(200, {
        ok: true,
        user_id: session.user.id,
        updated: {
          origin_iata: updatedOrigin,
          passenger_count: safePassengerCount,
          trip_length: trip_length ?? null,
          has_pet: has_pet ?? null,
          away_needs: safeAwayNeeds ?? null,
          frequency: frequency ?? null,
          paused_until: paused_until ?? undefined,
        },
      });"""

if target_sql in content:
    content = content.replace(target_sql, replacement_sql)
    print("Preferences POST SQL patched")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
