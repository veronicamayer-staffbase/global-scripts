# Jira My Tickets — local proxy

Backs the `widgets/jira-my-tickets.html` widget with live Jira data.
Jira Cloud can't be called from a browser (no CORS), and an API token must never
sit in a public widget, so this small Node server holds the credentials and
exposes `GET /api/my-tickets` on `127.0.0.1`.

## Run

Needs Node 18+. No dependencies.

```sh
export JIRA_SITE=https://staffbaseconnect2.atlassian.net
export JIRA_EMAIL=<your Atlassian login email>
export JIRA_API_TOKEN=<token from id.atlassian.com → Security → API tokens>
node server.mjs
```

Then serve the widgets folder and open the widget with `?api=` pointing at the proxy
(default is `http://127.0.0.1:8787`, so `?api` can be omitted):

```sh
cd widgets && python3 -m http.server 8000
# open http://localhost:8000/jira-my-tickets.html
```

## Config

| Env var | Default | Purpose |
|---|---|---|
| `JIRA_SITE` | — (required) | Jira Cloud base URL |
| `JIRA_EMAIL` | — (required) | Account the token belongs to |
| `JIRA_API_TOKEN` | — (required) | API token (never commit it) |
| `JIRA_JQL` | `assignee = currentUser() ORDER BY updated DESC` | Which tickets to show |
| `PORT` | `8787` | Listen port (bound to 127.0.0.1) |
| `ALLOWED_ORIGINS` | `null,http://localhost:8000,http://127.0.0.1:8000,https://staffbase.github.io` | Origins allowed to read responses |

## Security notes

- Only requests to `localhost`/`127.0.0.1` are answered (DNS-rebinding guard).
- Only allow-listed origins can read responses, so other web pages can't pull your tickets.
- The token stays in the environment; the widget never sees it.
- Returns at most 100 tickets per request (Jira page size).

## Endpoint

`GET /api/my-tickets` → `{ site, count, issues: [{ key, url, summary, status{name,category}, priority, type, assignee, reporter, created, updated, labels, description }] }`

Errors: `403` origin/host not allowed, `404` unknown path, `502` proxy could not reach Jira, or Jira's own status code with `detail`.
