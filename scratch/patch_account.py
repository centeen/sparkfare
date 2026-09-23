import os
import re

html_file = r'c:\Users\cente\sparkfare\account.html'
with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add CSS to head
css_block = """  <style>
    .checklist-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .checklist-row:last-child { border-bottom: none; }
    .checklist-label { font-weight: 600; color: var(--text); font-size: 0.95rem; }
    .checklist-actions { display: flex; gap: 8px; }
    .btn-pill {
      background: transparent; color: var(--text); border: 1px solid var(--border);
      padding: 6px 14px; border-radius: 99px; font-weight: 600; cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-pill.yes.active { background: #E8B930; border-color: #E8B930; color: #2B2620; }
    .btn-pill.no.active { background: var(--border); }
  </style>
</head>"""
content = content.replace('</head>', css_block)

# 2. Replace the has_pet field with the new checklist
old_field = """        <div class="field" style="display:flex; align-items:center; gap:8px;">
          <input id="has_pet" type="checkbox" style="width:auto; margin:0;" />
          <label for="has_pet" style="margin:0; font-weight:normal;">I travel with a pet</label>
        </div>"""

new_panel = """      <div id="customize-trip-panel" style="background: var(--card); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 24px; overflow: hidden;">
        <div id="customize-trip-header" style="padding: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
          <strong style="color: var(--text);">Customize your trip (Away Mode)</strong>
          <span style="color: var(--muted); font-size: 0.9rem;">9 quick questions — skip any you want →</span>
        </div>
        <div id="customize-trip-content" style="display: none; border-top: 1px solid var(--border); padding: 0;">
          <div class="checklist-row" data-key="pet">
            <span class="checklist-label">Traveling with a pet?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="insurance">
            <span class="checklist-label">Need travel insurance?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="bags">
            <span class="checklist-label">Need somewhere for your bags?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="mail">
            <span class="checklist-label">Want your mail forwarded?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="flight_delay">
            <span class="checklist-label">Want flight-delay compensation?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="data_arrival">
            <span class="checklist-label">Need data on arrival?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="public_wifi">
            <span class="checklist-label">Using public Wi-Fi?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="language">
            <span class="checklist-label">Want to learn the language?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
          <div class="checklist-row" data-key="currency">
            <span class="checklist-label">Spending in another currency?</span>
            <div class="checklist-actions">
              <button type="button" class="btn-pill yes" data-answer="yes">Yes</button>
              <button type="button" class="btn-pill no" data-answer="no">No</button>
            </div>
          </div>
        </div>
      </div>"""
content = content.replace(old_field, new_panel)

# 3. Add hydration logic
old_hydration = """                if (data.preferences.has_pet !== null && data.preferences.has_pet !== undefined) {
                  document.getElementById('has_pet').checked = !!data.preferences.has_pet;
                }"""

new_hydration = """                const awayNeedsStr = data.preferences.away_needs || '[]';
                let awayNeeds = [];
                try { awayNeeds = JSON.parse(awayNeedsStr); } catch(e) {}
                
                if (data.preferences.has_pet) {
                   if (!awayNeeds.includes('pet')) awayNeeds.push('pet');
                }
                
                awayNeeds.forEach(key => currentNeeds[key] = true);
                renderChecklistUI();"""
content = content.replace(old_hydration, new_hydration)

# 4. Add form submission logic and UI logic
old_payload = """        const payload = {
          origin_iata: document.getElementById('origin_iata').value,
          trip_length: document.getElementById('trip_length').value,
          passenger_count: parseInt(document.getElementById('passenger_count').value, 10),
          has_pet: document.getElementById('has_pet').checked ? 1 : 0
        };"""

new_payload = """        const needsArray = Object.keys(currentNeeds).filter(k => currentNeeds[k] === true);
        const payload = {
          origin_iata: document.getElementById('origin_iata').value,
          trip_length: document.getElementById('trip_length').value,
          passenger_count: parseInt(document.getElementById('passenger_count').value, 10),
          has_pet: currentNeeds['pet'] === true ? 1 : 0,
          away_needs: JSON.stringify(needsArray)
        };"""
content = content.replace(old_payload, new_payload)

# 5. Append Checklist UI script logic before form.addEventListener
old_js_start = """    form.addEventListener('submit', async (e) => {"""

new_js_logic = """    let currentNeeds = {}; // e.g. { pet: true, bags: false }
    
    // Expand/Collapse panel
    const panelHeader = document.getElementById('customize-trip-header');
    const panelContent = document.getElementById('customize-trip-content');
    if(panelHeader) {
      panelHeader.addEventListener('click', () => {
        if (panelContent.style.display === 'none') {
          panelContent.style.display = 'block';
        } else {
          panelContent.style.display = 'none';
        }
      });
    }
    
    function renderChecklistUI() {
      document.querySelectorAll('.checklist-row').forEach(row => {
        const key = row.dataset.key;
        const yesBtn = row.querySelector('.btn-pill.yes');
        const noBtn = row.querySelector('.btn-pill.no');
        
        yesBtn.classList.remove('active');
        noBtn.classList.remove('active');
        
        if (currentNeeds[key] === true) {
           yesBtn.classList.add('active');
        } else if (currentNeeds[key] === false) {
           noBtn.classList.add('active');
        }
      });
    }
    
    // Bind buttons
    document.querySelectorAll('.checklist-row').forEach(row => {
      const key = row.dataset.key;
      const yesBtn = row.querySelector('.btn-pill.yes');
      const noBtn = row.querySelector('.btn-pill.no');
      
      yesBtn.addEventListener('click', () => {
         currentNeeds[key] = true;
         renderChecklistUI();
      });
      
      noBtn.addEventListener('click', () => {
         currentNeeds[key] = false;
         renderChecklistUI();
      });
    });

    form.addEventListener('submit', async (e) => {"""

content = content.replace(old_js_start, new_js_logic)

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(content)
