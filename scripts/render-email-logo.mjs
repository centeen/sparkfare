import fs from 'node:fs';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

await initWasm(fs.readFileSync(new URL('../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url)));
const svg = fs.readFileSync(new URL('../sparkfare_mark.svg', import.meta.url), 'utf8').replace(/<metadata>[\s\S]*?<\/metadata>/, '');

const variants = { light: svg, dark: svg.replace('#2B2620', '#EDE6D6') };
for (const [name, source] of Object.entries(variants)) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: 56 } }).render().asPng();
  fs.writeFileSync(new URL(`../email-assets/sparkfare-mark-${name}.png`, import.meta.url), png);
  console.log(`wrote sparkfare-mark-${name}.png (${png.length} bytes)`);
}
