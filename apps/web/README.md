# Web App (Current MVP Reference)

Scope:
- Managed federated sign-in for web/API access using OIDC Authorization Code
  with PKCE.
- Match list with sortable columns and filters:
  - team/home/away
  - location club
  - field
  - source (`knhb` / `web-custom` / `local`)
- Match creation flows:
  - quick local match
  - custom match form
  - KNHB import (new match or assign to existing match)
- KNHB browse and import:
  - clubs and teams
  - upcoming match loading
  - logical team favorites grouped by same-name variants (for example `veld`/`zaal`)
- Match metadata management:
  - edit home/away/date/location/field
  - edit `knhbMatchId` and `knhbSourceTeamId`
  - refresh metadata from KNHB (`upcoming` + `official`)
- Live match controls:
  - score changes and timer controls via event upsert
  - period and match end actions
  - polling-based event/projection refresh
  - event stream table and scoreboard presentation mode

Key files:
- `apps/web/index.html`
- `apps/web/src/main.ts`
- `apps/web/src/knhb-parsing.js`
- `apps/web/src/styles.css`

Run locally:
```sh
npm run start:events
npm run build:web
npm run -w @hockey-timer/web serve
```

Defaults:
- Web: `http://localhost:4173`
- Backend API expected at: `http://localhost:8787`

Auth runtime config:
- `__AUTH_AUTHORIZATION_ENDPOINT__`
- `__AUTH_TOKEN_ENDPOINT__`
- `__AUTH_CLIENT_ID__`
- `__AUTH_AUDIENCE__` (optional)
- `__AUTH_SCOPE__` (default `openid profile email`)
- `__AUTH_REDIRECT_URI__`

These are set in `public/config.js` or replaced by hosted runtime config. If
auth is not configured, web API sync is disabled rather than falling back to
unauthenticated hosted access.
