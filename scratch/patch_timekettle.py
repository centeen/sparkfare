import os

# 1. Update disclosure.html
disclosure_path = r'c:\Users\cente\sparkfare\disclosure.html'
with open(disclosure_path, 'r', encoding='utf-8') as f:
    disc_content = f.read()

target_str = "Rocket Languages (language learning), and Wise (multi-currency banking & international spending)."
repl_str = "Rocket Languages (language learning), Wise (multi-currency banking & international spending), and Timekettle (translation gear)."

if target_str in disc_content:
    disc_content = disc_content.replace(target_str, repl_str)
    with open(disclosure_path, 'w', encoding='utf-8') as f:
        f.write(disc_content)


# 2. Update away-mode.html
away_path = r'c:\Users\cente\sparkfare\away-mode.html'
with open(away_path, 'r', encoding='utf-8') as f:
    away_content = f.read()

# Add to KEY_MAP
key_map_target = """      'language': 'rocket-languages',
      'currency': 'wise'
    };"""
key_map_repl = """      'language': 'rocket-languages',
      'currency': 'wise',
      'gear': 'timekettle'
    };"""

if key_map_target in away_content:
    away_content = away_content.replace(key_map_target, key_map_repl)

# Add checklist question
checklist_target = """          <div class="checklist-row" data-key="currency">
            <span class="checklist-label">Spending in another currency?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
        </div>"""
checklist_repl = """          <div class="checklist-row" data-key="currency">
            <span class="checklist-label">Spending in another currency?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="gear">
            <span class="checklist-label">Need translation earbuds?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
        </div>"""

if checklist_target in away_content:
    away_content = away_content.replace(checklist_target, checklist_repl)
    
# Update comment header
comment_target = "NordVPN (travel data security) approved via\n            CJ and added 2026-09-16, per the user directly. Wise (FinTech & multi-currency card) approved\n            via Partnerize and added 2026-09-18, per the user directly."
comment_repl = "NordVPN (travel data security) approved via\n            CJ and added 2026-09-16, per the user directly. Wise (FinTech & multi-currency card) approved\n            via Partnerize and added 2026-09-18, per the user directly. Timekettle (translation gear) approved via Awin and added 2026-09-23."
if comment_target in away_content:
    away_content = away_content.replace(comment_target, comment_repl)

with open(away_path, 'w', encoding='utf-8') as f:
    f.write(away_content)

print("Timekettle added to UI")
