# Security Policy

## Supported Versions

This project is maintained on the `main` branch.

## Reporting a Vulnerability

Please do not disclose security issues in public GitHub issues.

Report privately with:
- clear description of the issue
- impact assessment
- steps to reproduce
- suggested remediation (if known)

## Secret Handling Requirements

- Never commit `secrets.h`
- Never commit Supabase service role keys
- Never expose Cloudflare API tokens
- Rotate any credential immediately if accidental exposure is suspected

## Scope

Security-sensitive surfaces include:
- Worker secret management and CORS policy
- Firmware credentials and device network access
- Supabase key and row access permissions
