// The Brand v1 colours for email. Email cannot read CSS custom properties, so the values are written out here, in one place. They are
// copied from brand/tokens.css (light) and its prefers-color-scheme: dark block (night); tests/k_b8_emails.test.js fails if either differs.
// Gold is the deal signal only: the Deal chip. Nothing else in an email is gold.
export const EMAIL_LIGHT = {
  paper: '#F5EFE3',
  card: '#FFFCF6',
  paperDeep: '#EBE2D0',
  ink: '#231C14',
  ink2: '#5A4C3C',
  spark: '#E8B930',
  onSpark: '#231C14',
  sage: '#2F6B47',
  // Text on a Sage fill. brand/tokens.css says #FFFFFF; email avoids pure white (dark-mode clients invert it, and tests/email_daily_digest.test.js forbids it),
  // so this is the card colour, which is 6.1:1 on Sage (white is 6.3:1).
  onSage: '#FFFCF6',
  line: '#DCCFB8',
};

export const EMAIL_NIGHT = {
  paper: '#17130E',
  card: '#211B14',
  paperDeep: '#2A231A',
  ink: '#F2EADB',
  ink2: '#B9AC97',
  sage: '#7FBF93',
  onSage: '#17130E',
  line: '#3A3128',
};
