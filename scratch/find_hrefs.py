import re

with open('away-mode.html', 'r', encoding='utf-8') as f:
    content = f.read()

hrefs = re.findall(r'href=[\'"](/[^\'"]+)[\'"]', content)
for href in set(hrefs):
    print(href)
