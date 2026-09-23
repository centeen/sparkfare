import os

file_path = r'C:\Users\cente\sparkfare\src\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """  if (url.pathname === '/api/verify' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { ok: false, error: 'Request body must be valid JSON' });
    }

    const { email } = body;
    if (!email) {
      return jsonResponse(400, { ok: false, error: 'Email is required' });
    }

    if (env?.DB) {
      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (!user) {
        return jsonResponse(404, { ok: false, error: 'User not found' });
      }

      const result = await env.DB.prepare('UPDATE users SET verified_email = 1 WHERE email = ?').bind(email).run();
      if (!result || result.success === false) {
        return jsonResponse(500, { ok: false, error: 'Failed to verify user' });
      }
    }

    const verificationUrl = `${env.APP_URL || 'https://sparkfare.com'}/account`;
    try {
      await sendVerificationEmail({ email, verificationUrl }, env);
    } catch (error) {
      console.error('Verification email send failed:', error);
      return jsonResponse(200, {
        ok: true,
        verified_email: 1,
        email,
        email_send_error: error.message || 'Email send failed',
      });
    }

    return jsonResponse(200, { ok: true, verified_email: 1, email });
  }"""

replacement = """  if (url.pathname === '/api/verify' && request.method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response('Invalid or missing verification link', { status: 400 });
    }

    if (env?.DB) {
      const user = await env.DB.prepare('SELECT email FROM users WHERE verification_token = ?').bind(token).first();
      if (!user) {
        return new Response('This verification link has expired or is invalid.', { status: 404 });
      }

      const result = await env.DB.prepare('UPDATE users SET verified_email = 1, verification_token = NULL WHERE verification_token = ?').bind(token).run();
      if (!result || result.success === false) {
        return new Response('Failed to verify user', { status: 500 });
      }
    }

    return Response.redirect('https://sparkfare.com/', 302);
  }"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Verify endpoint patched successfully")
else:
    print("Target verify endpoint not found")
