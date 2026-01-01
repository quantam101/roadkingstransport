# Security notes (production)

## No client-side secrets
Do not embed private API keys in HTML/JS. If you need third-party integrations:
- Create a serverless function endpoint (Netlify Functions / Vercel Serverless / Cloudflare Workers).
- Store secrets in the host's environment variables.
- Proxy requests through that function and apply rate limiting + allowlists.

## Headers included
This package includes recommended headers:
- Netlify: `_headers`
- Vercel: `vercel.json`

These enforce:
- Clickjacking protection (DENY)
- MIME sniffing protection (nosniff)
- Strict referrer policy
- Permissions Policy (deny by default)
- HSTS (HTTPS only)
- CSP (baseline; prefer headers on host)

## Contact form handling
The contact form is safe by default:
- If configured with `data-mailto` it opens a mail client.
- If not configured, it stores the message locally (no transmission).

## Recommended operational hardening
- Turn on HTTPS only
- Add a WAF/CDN on production (Cloudflare is common)
- Enable bot protection + rate limiting for any public API endpoint
- Maintain a change log and review cadence
