// The leave-by rules run in the Worker (src/data/leaveByRules.js) and in the browser (/leave-by-rules.js, so a guest's plan is
// computed on their own device and their dates never reach the server). They are the same file: edit the one in src/data, then run
//   node scripts/sync-leave-by-rules.js
// tests/leave_by_plan_page.test.js fails if the two differ.
import fs from 'node:fs';
const from = new URL('../src/data/leaveByRules.js', import.meta.url);
const to = new URL('../leave-by-rules.js', import.meta.url);
fs.copyFileSync(from, to);
console.log('copied src/data/leaveByRules.js to leave-by-rules.js');
