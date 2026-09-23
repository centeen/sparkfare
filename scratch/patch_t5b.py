import os

file_path = r'C:\Users\cente\sparkfare\src\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update signature of renderRoutePage
sig_target = "function renderRoutePage(deal, origin, destination, partnersHtml, isThin) {"
sig_repl = "function renderRoutePage(deal, origin, destination, partnersHtml, isThin, env = {}) {"
content = content.replace(sig_target, sig_repl)

# 2. Add adHtml logic
jsonLd_target = """  </script>`;"""
jsonLd_repl = """  </script>`;

  const enableAds = env.ENABLE_T5B_ADS === 'true' && !isThin;
  const adHtml = enableAds ? `
    <div class="ad-slot" style="margin-top: 48px; text-align: center; background: #E3D9C4; padding: 24px; border-radius: 8px;">
      <span style="color: #6B6255; font-size: 0.85rem; display: block; margin-bottom: 12px; font-family: Arial, sans-serif;">Advertisement</span>
      <!-- Placeholder for self-serve ad network tag (e.g. AdSense) -->
      <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
      <ins class="adsbygoogle"
           style="display:block; min-height: 90px;"
           data-ad-client="ca-pub-0000000000000000"
           data-ad-slot="0000000000"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <script>
           (adsbygoogle = window.adsbygoogle || []).push({});
      </script>
    </div>
  ` : '';"""
content = content.replace(jsonLd_target, jsonLd_repl)

# 3. Inject adHtml into the body
body_target = """    </div>
  </main>"""
body_repl = """    </div>
    ${adHtml}
  </main>"""
content = content.replace(body_target, body_repl)

# 4. Update the call site
call_target = "return new Response(renderRoutePage(targetDeal, origin, destination, partnersHtml, isThin),"
call_repl = "return new Response(renderRoutePage(targetDeal, origin, destination, partnersHtml, isThin, env),"
content = content.replace(call_target, call_repl)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched index.js for T5b")
