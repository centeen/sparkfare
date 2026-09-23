# Resend DNS Configuration Checklist

For Sparkfare email deliverability (Task T7), the following DNS records must be added to your domain registrar/host (e.g., Cloudflare, Route53, Namecheap) to ensure high inbox placement rates and compliance with DMARC policies.

> [!CAUTION]
> These DNS records are configured in your DNS hosting provider's dashboard, not in this codebase.

## 1. Domain Verification (SPF & DKIM)

Resend provides 3 DNS records for verifying the sending domain. Add these in your DNS dashboard:

- [ ] **DKIM (1/2)**
  - Type: `TXT`
  - Name: `resend._domainkey` (or `resend._domainkey.sparkfare.com`)
  - Value: *(Provided by Resend Dashboard, e.g., `p=MIGf...`)*

- [ ] **DKIM (2/2)**
  - Type: `TXT`
  - Name: `_dmarc` (or `_dmarc.sparkfare.com`)
  - Value: `v=DMARC1; p=none;` *(You can upgrade this to `p=quarantine` or `p=reject` later)*

- [ ] **SPF (Sender Policy Framework)**
  - Type: `TXT`
  - Name: `@` (or `sparkfare.com`)
  - Value: `v=spf1 include:sendgrid.net include:resend.com ~all`
  *Note: If you already have an SPF record for `@`, DO NOT add a second one. Instead, merge the `include:resend.com` statement into the existing record.*

## 2. Custom Return-Path (Bounces)

To handle bounces natively and improve reputation, you must set a custom Return-Path domain (e.g., `bounces.sparkfare.com`).

- [ ] **Return Path (CNAME)**
  - Type: `CNAME`
  - Name: `bounces` (or `bounces.sparkfare.com`)
  - Value: *(Provided by Resend, typically `feedback.resend.com`)*
  - **Important for Cloudflare users:** Make sure the proxy status is **DNS Only (Gray Cloud)**, NOT Proxied (Orange Cloud).

---

### Verification Steps
Once you've added these records to your DNS host:
1. Go to your **Resend Dashboard** > **Domains**.
2. Click **Verify DNS Records**. 
3. *Note: DNS propagation can take up to 24-48 hours, though it typically takes just a few minutes.*
