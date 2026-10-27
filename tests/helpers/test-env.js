// Preloaded by `npm test` and the PR workflow (node --test --import): the process-level fallback for EMAIL_POSTAL_ADDRESS that src/email.js reads when a test
// builds its own env. Since Q4 (D-049) non-transactional email is skipped without a postal address, so every test that sends a commercial email needs one.
// Tests of the fail-closed rule delete it explicitly (see tests/q4_compliance.test.js).
process.env.EMAIL_POSTAL_ADDRESS ??= '1 Test Street, Test City, TS 00000';
