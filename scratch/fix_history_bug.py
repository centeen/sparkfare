import json
import os
import shutil
from datetime import datetime

script_path = r'c:\Users\cente\sparkfare\Phase 1 Deal Ranking Script (Step 9 - with fallback).py'

with open(script_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert make_route_key
make_route_key_func = """def make_route_key(entry: dict, feed_key: str) -> str:
    display_name = entry.get("display_name", feed_key)
    return f"{entry['origin']}:{display_name}" if entry.get("origin") else display_name


def update_history"""

content = content.replace("def update_history", make_route_key_func)

# 2. Update update_history
old_uh_key = 'route_key = f"{entry[\'origin\']}:{display_name}" if entry.get("origin") else display_name'
new_uh_key = 'route_key = make_route_key(entry, display_name)'
content = content.replace(old_uh_key, new_uh_key)

# 3. Update classify_destination
old_cd_key = 'route_key = f"{entry[\'origin\']}:{display_name}" if entry.get("origin") else display_name'
new_cd_key = 'route_key = make_route_key(entry, display_name)'
content = content.replace(old_cd_key, new_cd_key)

with open(script_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched Python script.")

# Migration
files_to_migrate = [
    r'c:\Users\cente\sparkfare\sparkfare_price_history_other_origins.json',
    r'c:\Users\cente\sparkfare\sparkfare_hourly_price_history.json'
]

for file_path in files_to_migrate:
    if not os.path.exists(file_path):
        continue
    
    # Backup
    backup_path = file_path + ".bak"
    shutil.copy2(file_path, backup_path)
    print(f"Backed up {os.path.basename(file_path)} to .bak")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        history = json.load(f)
    
    new_history = {}
    keys_to_delete = []
    
    for key, observations in history.items():
        parts = key.split(':')
        if len(parts) >= 3 and parts[0] == parts[1]:
            # It's a double prefix (e.g. LAX:LAX:Bali)
            new_key = ":".join(parts[1:])
            
            # Merge observations into new_key
            merged_obs = history.get(new_key, [])
            
            # Create a dict keyed by date to find minimum price per date
            date_map = {}
            for obs in merged_obs + observations:
                date_str = obs['date']
                if date_str not in date_map or obs['price'] < date_map[date_str]['price']:
                    date_map[date_str] = obs
                    
            # Sort by date
            new_history[new_key] = sorted(list(date_map.values()), key=lambda x: x['date'])
            keys_to_delete.append(key)
        else:
            if key not in new_history:
                new_history[key] = observations
                
    for old_key in keys_to_delete:
        if old_key in new_history:
            del new_history[old_key]
            
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(new_history, f, indent=2, ensure_ascii=False)
    
    print(f"Migrated {os.path.basename(file_path)}: Fixed {len(keys_to_delete)} double-prefixed keys.")
