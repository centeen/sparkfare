import os
import re

def patch_file(file_path, html_inserts, js_payload_inserts, js_population_inserts=None):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. HTML Inserts
    target_html = """        <div class="field">
          <label for="trip_length">Trip length</label>"""
    if "Typical trip length" in content: # For account.html
        target_html = """        <div class="field">
          <label for="trip_length">Typical trip length</label>"""

    insertion = """
        <div class="field">
          <label for="frequency">Email Frequency</label>
          <select id="frequency">
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly digest</option>
            <option value="instant">Instant (Rare Finds only)</option>
          </select>
        </div>

        <div class="field">
          <label for="paused_until">Pause Alerts</label>
          <select id="paused_until">
            <option value="null">None (Active)</option>
            <option value="1_week">1 week</option>
            <option value="1_month">1 month</option>
            <option value="indefinite">Indefinitely</option>
          </select>
        </div>
"""
    if target_html in content:
        content = content.replace(target_html, insertion + target_html)
        print(f"Patched HTML in {file_path}")

    # 2. JS Payload
    target_js_payload = """        trip_length: document.getElementById('trip_length').value,"""
    insertion_js = """
        frequency: document.getElementById('frequency').value,
        paused_until: (() => {
           const v = document.getElementById('paused_until').value;
           if (v === 'null') return 'null';
           if (v === 'indefinite') return '9999-12-31T23:59:59Z';
           const d = new Date();
           if (v === '1_week') d.setDate(d.getDate() + 7);
           if (v === '1_month') d.setMonth(d.getMonth() + 1);
           return d.toISOString();
        })(),"""
    if target_js_payload in content:
        content = content.replace(target_js_payload, target_js_payload + insertion_js)
        print(f"Patched JS Payload in {file_path}")
        
    # 3. JS Population
    if js_population_inserts:
        if js_population_inserts in content:
            pop_code = """
                if (data.preferences.frequency) {
                  document.getElementById('frequency').value = data.preferences.frequency;
                }
                if (data.preferences.paused_until) {
                  const p = data.preferences.paused_until;
                  if (p === '9999-12-31T23:59:59Z') {
                      document.getElementById('paused_until').value = 'indefinite';
                  } else {
                      // Fallback: Custom dates from DB just show as active or we could add a custom option.
                      // For now, if paused in future, let's keep it simple.
                  }
                }
            """
            content = content.replace(js_population_inserts, js_population_inserts + pop_code)
            print(f"Patched JS Population in {file_path}")

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

base_dir = r'C:\Users\cente\sparkfare'

# preferences.html
patch_file(
    os.path.join(base_dir, 'preferences.html'),
    html_inserts=True,
    js_payload_inserts=True,
)

# account.html
patch_file(
    os.path.join(base_dir, 'account.html'),
    html_inserts=True,
    js_payload_inserts=True,
    js_population_inserts="document.getElementById('trip_length').value = data.preferences.trip_length;\n                }"
)
