// Sitewide referral-positioning footer (decision logged 2026-10-07). One definition, injected on
// every static page with <script src="/site-footer.js" defer></script>. The Worker-rendered pages
// and emails read the same wording from src/referralCopy.js; tests/referral_copy.test.js fails if
// the two copies differ.
(function () {
  var LINE_1 = "Sparkfare is a deal-information service. We don't sell, book or arrange travel, and we never take payment. When you click a fare, you buy from Aviasales or another site you choose.";
  var LINE_2 = 'Prices are indications and can change. Sponsored links may earn Sparkfare a commission.';

  if (typeof document === 'undefined' || document.getElementById('site-referral-footer')) return;

  var box = document.createElement('div');
  box.id = 'site-referral-footer';
  box.setAttribute('style', 'max-width:760px;margin:24px auto 0;padding:16px 16px 8px;border-top:1px solid #D9CBB0;font:14px/1.5 "Segoe UI",Arial,sans-serif;color:#5A5145;text-align:left;');

  var p1 = document.createElement('p');
  p1.setAttribute('style', 'margin:0 0 8px;');
  p1.textContent = LINE_1;

  var p2 = document.createElement('p');
  p2.setAttribute('style', 'margin:0 0 8px;');
  p2.appendChild(document.createTextNode(LINE_2 + ' '));
  [['Disclosure', '/disclosure'], ['Terms', '/terms'], ['Privacy', '/privacy']].forEach(function (l, i) {
    if (i) p2.appendChild(document.createTextNode(' · '));
    var a = document.createElement('a');
    a.href = l[1];
    a.textContent = l[0];
    a.setAttribute('style', 'color:#2B2620;text-decoration:underline;');
    p2.appendChild(a);
  });

  box.appendChild(p1);
  box.appendChild(p2);

  var footer = document.querySelector('footer');
  if (footer) footer.insertBefore(box, footer.firstChild);
  else document.body.appendChild(box);
})();
