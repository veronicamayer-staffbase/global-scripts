#!/usr/bin/env node
// Local proxy for the "Jira My Tickets" widget.
//
// Why it exists: Jira Cloud's REST API cannot be called from a browser on another
// origin (no CORS), and an API token must never be shipped inside a public widget.
// This tiny server holds the credentials, calls Jira, and returns a trimmed JSON list.
//
// Requires Node 18+. No dependencies.
//
// Usage:
//   JIRA_SITE=https://staffbaseconnect2.atlassian.net \
//   JIRA_EMAIL=you@example.com \
//   JIRA_API_TOKEN=xxxx \
//   node server.mjs
//
// Optional env:
//   JIRA_JQL          default: "assignee = currentUser() ORDER BY updated DESC"
//   PORT              default: 8787 (bound to 127.0.0.1 only)
//   ALLOWED_ORIGINS   comma list of origins allowed to read responses

import http from 'node:http';

const SITE = (process.env.JIRA_SITE || '').replace(/\/+$/, '');
const EMAIL = process.env.JIRA_EMAIL || '';
const TOKEN = process.env.JIRA_API_TOKEN || '';
const PORT = Number(process.env.PORT || 8787);
const JQL = process.env.JIRA_JQL || 'assignee = currentUser() ORDER BY updated DESC';
const ALLOWED = (process.env.ALLOWED_ORIGINS ||
    'null,http://localhost:8000,http://127.0.0.1:8000,https://staffbase.github.io')
    .split(',').map(s => s.trim()).filter(Boolean);
const FIELDS = ['summary', 'status', 'priority', 'issuetype', 'assignee', 'reporter',
    'created', 'updated', 'description', 'labels'];

if (!SITE || !EMAIL || !TOKEN) {
    console.error('Missing config: set JIRA_SITE, JIRA_EMAIL and JIRA_API_TOKEN.');
    process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64');
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

// Jira descriptions are Atlassian Document Format (ADF). Flatten to plain text.
function adfToText(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    const inner = (node.content || []).map(adfToText).join('');
    const block = ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(node.type);
    return block ? inner + '\n' : inner;
}

function mapIssue(issue) {
    const f = issue.fields || {};
    return {
        key: issue.key,
        url: `${SITE}/browse/${issue.key}`,
        summary: f.summary || '',
        status: f.status ? {
            name: f.status.name,
            category: f.status.statusCategory?.key || 'new', // new | indeterminate | done
        } : null,
        priority: f.priority?.name || null,
        type: f.issuetype?.name || null,
        assignee: f.assignee?.displayName || null,
        reporter: f.reporter?.displayName || null,
        created: f.created || null,
        updated: f.updated || null,
        labels: f.labels || [],
        description: adfToText(f.description).trim(),
    };
}

const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || '';
    const originAllowed = ALLOWED.includes(origin);
    if (originAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // DNS-rebinding guard: only answer requests addressed to localhost.
    const host = (req.headers.host || '').replace(/:\d+$/, '');
    if (host !== 'localhost' && host !== '127.0.0.1') {
        res.writeHead(403, JSON_HEADERS);
        return res.end(JSON.stringify({ error: 'forbidden host' }));
    }

    if (req.method === 'OPTIONS') {
        res.writeHead(originAllowed ? 204 : 403);
        return res.end();
    }

    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET' || url.pathname !== '/api/my-tickets') {
        res.writeHead(404, JSON_HEADERS);
        return res.end(JSON.stringify({ error: 'not found' }));
    }
    if (!originAllowed) {
        res.writeHead(403, JSON_HEADERS);
        return res.end(JSON.stringify({ error: 'origin not allowed' }));
    }

    try {
        const jiraRes = await fetch(`${SITE}/rest/api/3/search/jql`, {
            method: 'POST',
            headers: { Authorization: AUTH, Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ jql: JQL, fields: FIELDS, maxResults: 100 }),
        });
        const body = await jiraRes.json().catch(() => ({}));
        if (!jiraRes.ok) {
            res.writeHead(jiraRes.status, JSON_HEADERS);
            return res.end(JSON.stringify({ error: 'jira', status: jiraRes.status, detail: body.errorMessages || body }));
        }
        const issues = (body.issues || []).map(mapIssue);
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ site: SITE, count: issues.length, issues }));
    } catch (err) {
        res.writeHead(502, JSON_HEADERS);
        res.end(JSON.stringify({ error: 'proxy', detail: String(err) }));
    }
});

// Jira answers 200 with an empty list for an invalid token on currentUser() queries,
// so verify the credentials once at startup instead of showing a silently empty widget.
async function verifyCredentials() {
    const r = await fetch(`${SITE}/rest/api/3/myself`, {
        headers: { Authorization: AUTH, Accept: 'application/json' },
    });
    if (!r.ok) {
        console.error(`Jira rejected the credentials (HTTP ${r.status}). Check JIRA_EMAIL and JIRA_API_TOKEN.`);
        process.exit(1);
    }
    const me = await r.json().catch(() => ({}));
    return me.displayName || me.emailAddress || EMAIL;
}

verifyCredentials().then(user => {
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`Jira proxy for ${user} on http://127.0.0.1:${PORT}/api/my-tickets`);
        console.log(`Site: ${SITE} | JQL: ${JQL}`);
    });
}).catch(err => {
    console.error(`Could not reach Jira at ${SITE}: ${err}`);
    process.exit(1);
});
