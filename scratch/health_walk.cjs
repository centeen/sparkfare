const https = require("https");
const raw = (u, method = "GET") => new Promise((res, rej) => {
  const r = https.request(u, { method }, x => { let s = ""; x.on("data", d => s += d).on("end", () => res({ code: x.statusCode, headers: x.headers, body: s })); });
  r.on("error", rej); r.end();
});
(async () => {
  console.log("== Check 1/1b");
  const out = {};
  for (const u of ["https://sparkfare.com/sparkfare_ranked_deals.json", "https://sparkfare.com/sparkfare_ranked_deals_other_origins.json"]) {
    const r = await raw(u + "?x=" + Date.now()); const d = JSON.parse(r.body);
    const age = ((Date.now() - new Date(d.generated_at)) / 36e5).toFixed(1);
    console.log(u.split("/").pop(), "generated_at", d.generated_at, "age_h", age);
    for (const v of Object.values(d)) if (Array.isArray(v)) for (const x of v) {
      const o = x.origin || "JFK"; const c = out[o] = out[o] || { priced: 0, deal: 0, total: 0 }; c.total++;
      if (x.price > 0 && x.status !== "no_data" && x.status !== "insufficient_history") c.priced++;
      if (x.status === "deal") c.deal++;
    }
  }
  for (const [o, c] of Object.entries(out).sort()) console.log(o.padEnd(4), "priced", c.priced + "/" + c.total, c.deal ? "deals " + c.deal : "");
  console.log("== Check 2");
  const p = JSON.parse((await raw("https://sparkfare.com/api/partners")).body);
  const arr = Array.isArray(p) ? p : (p.partners || p);
  console.log(arr.length, "partners; empty blurbs:", arr.filter(x => !(x.blurb || "").trim()).length);
  for (const path of ["/away-mode", "/out/bounce", "/out/safetywing", "/api/health", "/", "/check", "/leave", "/time-off", "/time-off/jfk", "/time-off/phl", "/time-off/tlv",
    "/flight/DEN/Bali%2C%20Indonesia", "/data/phl-to-lisbon-portugal", "/hub", "/disclosure"]) {
    const r = await raw("https://sparkfare.com" + path);
    console.log(r.code, path, r.headers.location || "");
  }
  console.log("== Check 10");
  const sm = (await raw("https://sparkfare.com/sitemap-routes.xml")).body;
  console.log("sitemap-routes <loc>:", (sm.match(/<loc>/g) || []).length, "TLV/undefined:", /tlv|undefined/i.test(sm));
  const lax = (await raw("https://sparkfare.com/flight/LAX/Lisbon%2C%20Portugal")).body;
  console.log("LAX cta:", (lax.match(/href="[^"]*" class="cta"/g) || []));
  console.log("== Check 11 (PTO fares off)");
  const t = (await raw("https://sparkfare.com/time-off/dfw")).body;
  console.log("'Fares appear here' count:", (t.match(/Fares appear here as we see them/g) || []).length, " 'No fare seen yet':", (t.match(/No fare seen yet/g) || []).length);
  console.log("== SafetyWing on pages");
  for (const path of ["/disclosure", "/away-mode", "/"]) { const b = (await raw("https://sparkfare.com" + path)).body; console.log(path, "mentions safetywing:", /safetywing/i.test(b)); }
})().catch(e => { console.error(e); process.exit(1); });
