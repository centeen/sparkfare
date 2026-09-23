import os

html_file = r'c:\Users\cente\sparkfare\away-mode.html'
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
    .match-tag { font-size: 0.75rem; background: var(--amber); color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: normal; vertical-align: middle; }
  </style>
</head>"""
content = content.replace('</head>', css_block)

# 2. Replace personalization-banner with the new customize-trip-panel
old_banner = """      <div id="personalization-banner" style="display:none; background: #FFC107; padding:16px; border-radius:6px; margin-bottom: 24px; color:var(--text); font-size: 0.95rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong>Customize your trip:</strong> Traveling with a pet?
        </div>
        <div style="display:flex; gap:10px;">
          <button id="pet-yes" style="background:#fff; color:var(--text); border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Yes</button>
          <button id="pet-no" style="background:transparent; color:var(--text); border:1px solid rgba(0,0,0,0.2); padding:6px 12px; border-radius:4px; cursor:pointer;">No</button>
        </div>
      </div>"""

new_panel = """      <div id="customize-trip-panel" style="background: var(--card); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 24px; overflow: hidden;">
        <div id="customize-trip-header" style="padding: 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
          <strong style="color: var(--text);">Customize your trip</strong>
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

content = content.replace(old_banner, new_panel)

# 3. Replace JS logic for Clerk preferences
old_js_start = """          // Check preferences
          try {
            const token = await clerk.session.getToken();
            const res = await fetch('/api/account', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            
            if (data.ok && data.preferences) {
              if (data.preferences.has_pet === 1) {
                showPetPartners();
              } else if (data.preferences.has_pet === null || data.preferences.has_pet === undefined) {
                document.getElementById('personalization-banner').style.display = 'flex';
              }
            }
          } catch(e) { console.error('Pref fetch error', e); }"""

new_js_start = """          // Check preferences
          try {
            const token = await clerk.session.getToken();
            const res = await fetch('/api/account', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            
            if (data.ok && data.preferences) {
              const awayNeedsStr = data.preferences.away_needs || '[]';
              let awayNeeds = [];
              try { awayNeeds = JSON.parse(awayNeedsStr); } catch(e) {}
              
              if (data.preferences.has_pet) {
                 if (!awayNeeds.includes('pet')) awayNeeds.push('pet');
              }
              
              if (awayNeeds.length > 0) {
                 applyChecklistState(awayNeeds);
              }
            }
          } catch(e) { console.error('Pref fetch error', e); }"""

content = content.replace(old_js_start, new_js_start)

# 4. Replace custom JS logic for checkboxes / pet banner
old_js_end_start = """    // Checklist Logic
    const checkboxes = document.querySelectorAll('.partner-checkbox');"""

new_js_end = """    // Checklist Interaction Logic
    const KEY_MAP = {
      'insurance': 'safetywing',
      'bags': 'bounce',
      'mail': 'us-global-mail',
      'flight_delay': 'airhelp',
      'data_arrival': 'yesim',
      'public_wifi': 'nordvpn',
      'language': 'rocket-languages',
      'currency': 'wise'
    };
    
    let currentNeeds = {}; // e.g. { pet: true, bags: false }
    
    // Expand/Collapse panel
    const panelHeader = document.getElementById('customize-trip-header');
    const panelContent = document.getElementById('customize-trip-content');
    panelHeader.addEventListener('click', () => {
      if (panelContent.style.display === 'none') {
        panelContent.style.display = 'block';
      } else {
        panelContent.style.display = 'none';
      }
    });
    
    function applyChecklistState(needsArray) {
      needsArray.forEach(key => currentNeeds[key] = true);
      renderChecklistUI();
      reorderPartners();
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
    
    function reorderPartners() {
      const partnerList = document.querySelector('.partner-list');
      const allPartners = Array.from(partnerList.querySelectorAll('.partner'));
      
      // Separate matches vs non-matches
      const matches = [];
      const nonMatches = [];
      
      // Clean old tags
      allPartners.forEach(p => {
        const titleEl = p.querySelector('.partner-name');
        const tag = titleEl.querySelector('.match-tag');
        if (tag) tag.remove();
      });
      
      // Check each partner
      allPartners.forEach(p => {
        const slug = p.dataset.slug;
        let isMatch = false;
        
        // Find which key maps to this slug
        for (const [key, mappedSlug] of Object.entries(KEY_MAP)) {
           if (slug === mappedSlug && currentNeeds[key] === true) {
              isMatch = true;
              break;
           }
        }
        
        if (slug === 'rover' || slug === 'pet-gear') {
           if (currentNeeds['pet'] === true) {
              p.style.display = 'flex';
           } else {
              p.style.display = 'none';
           }
        }
        
        if (isMatch) {
           matches.push(p);
           const titleEl = p.querySelector('.partner-name');
           titleEl.insertAdjacentHTML('beforeend', '<span class="match-tag">Matches your trip</span>');
        } else {
           nonMatches.push(p);
        }
      });
      
      // Re-append in order (matches first, preserving relative order)
      matches.forEach(p => partnerList.appendChild(p));
      nonMatches.forEach(p => partnerList.appendChild(p));
    }
    
    async function saveStateToServer() {
       if (!isUserSignedIn) return;
       const clerk = window.Clerk;
       if (!clerk || !clerk.session) return;
       try {
         const token = await clerk.session.getToken();
         const needsArray = Object.keys(currentNeeds).filter(k => currentNeeds[k] === true);
         const payload = {};
         if (currentNeeds['pet'] !== undefined) {
            payload.has_pet = currentNeeds['pet'] ? 1 : 0;
         }
         payload.away_needs = JSON.stringify(needsArray);
         
         await fetch('/api/preferences', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
           body: JSON.stringify(payload)
         });
       } catch (e) {
         console.error('Failed to sync checklist to server', e);
       }
    }
    
    function loadLocalState() {
       const localStr = localStorage.getItem('sparkfare_away_needs');
       if (localStr) {
          try {
            const parsed = JSON.parse(localStr);
            parsed.forEach(key => currentNeeds[key] = true);
          } catch(e) {}
       }
       renderChecklistUI();
       reorderPartners();
    }
    
    function saveLocalState() {
       const needsArray = Object.keys(currentNeeds).filter(k => currentNeeds[k] === true);
       localStorage.setItem('sparkfare_away_needs', JSON.stringify(needsArray));
    }
    
    // Bind buttons
    document.querySelectorAll('.checklist-row').forEach(row => {
      const key = row.dataset.key;
      const yesBtn = row.querySelector('.btn-pill.yes');
      const noBtn = row.querySelector('.btn-pill.no');
      
      yesBtn.addEventListener('click', () => {
         currentNeeds[key] = true;
         renderChecklistUI();
         reorderPartners();
         saveLocalState();
         saveStateToServer();
      });
      
      noBtn.addEventListener('click', () => {
         currentNeeds[key] = false;
         renderChecklistUI();
         reorderPartners();
         saveLocalState();
         saveStateToServer();
      });
    });
    
    loadLocalState();
  </script>
"""
import re
content = re.sub(r'    // Checklist Logic.*?loadState\(\);\n  </script>\n', new_js_end, content, flags=re.DOTALL)

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(content)
