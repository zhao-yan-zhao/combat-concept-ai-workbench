# OIDC Deployment Boundary

## Status

This is a deployment design for a future managed identity path. The running intranet prototype continues to use its local account adapter by default.

## Required Boundary

1. The browser obtains short-lived access tokens through the organization's approved OIDC client flow. Tokens must not be stored in localStorage or report/archive payloads.
2. A same-origin reverse proxy or backend-for-frontend forwards the Bearer token only to protected workbench API requests. The browser does not send a token to Vault import, report files, archives, or local deployment tools.
3. `projectOidcIdentity.mjs` validates issuer, audience, expiry, `RS256` signature and JWKS key ID. The configured role claim maps only `researcher`, `reviewer`, and `lead` to the existing server-side collaboration capabilities.
4. Project-write authorization, collaboration review/decision, sensitive retrieval, sensitive-citation approval, audit reads, and AI configuration writes use the same verified actor source.
5. Local account setup, password login, account management and cookie logout routes are disabled at the proxy for an OIDC deployment. They remain available only in the explicit local prototype mode.

## Token Handling

- Access-token lifetime: deployment-owner policy; use short-lived tokens.
- Refresh: browser flow or proxy session only; never persist a refresh token in this application.
- JWKS cache: bounded and refreshed on an unknown key ID; fail closed when issuer keys cannot be retrieved.
- Logout: clear the proxy session and redirect to the identity-provider logout endpoint when required by organization policy.

## Acceptance Gates

- A valid token with a permitted role can create a review; only `lead` can resolve one.
- Expired, wrong-issuer, wrong-audience, wrong-signature and unknown-key tokens return `403` without project mutation.
- No token, JWKS response, authorization header, refresh token, or claim body enters reports, archives, project audit summaries, browser storage, or logs.
- The local account routes are unreachable in the OIDC deployment profile, while default local prototype behavior remains unchanged.
- A complete login, role authorization, logout and expiry rehearsal is performed in the target same-origin proxy deployment before enabling authenticated project writes.

## Deferred Decisions

- Organization-approved browser client flow and redirect URI.
- Proxy/session technology and cookie policy.
- JWKS cache lifetime and network egress rule.
- Role claim name, group-to-role mapping and offboarding retention.
