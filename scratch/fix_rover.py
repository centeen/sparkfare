with open('away-mode.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "if (slug === 'rover' || slug === 'pet-gear') {" in line:
        skip = True
    
    if not skip:
        new_lines.append(line)
        
    if skip and "}" in line and "p.style.display" not in line and "currentNeeds['pet']" not in line and "if (slug ===" not in line:
        # crude but we know the block is exactly 7 lines
        pass
    
    # Actually just remove lines 547 to 553 exactly
    
with open('away-mode.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

del lines[546:554]

with open('away-mode.html', 'w', encoding='utf-8') as f:
    f.writelines(lines)
