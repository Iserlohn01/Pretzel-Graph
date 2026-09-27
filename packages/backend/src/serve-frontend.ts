import * as express from 'express';
import type { RequestHandler } from 'express';
import { readFileSync, statSync } from 'fs';
import path from 'path';

// Paths the API answers; everything else belongs to the app's own router.
const API_PREFIXES = ['/api', '/webhook', '/webhook-test', '/oauth', '/health', '/socket'];

// Served by their own handler, so a miss is a 404 rather than the shell.
const ASSET_PREFIX = '/assets';

/** What the page tells the app about itself, read at runtime. */
function publicConfig(): Record<string, string | undefined> {
    return {
        apiUrl:              process.env.PUBLIC_API_URL ?? '/',
        authUrl:             process.env.PUBLIC_AUTH_URL,
        cloudUrl:            process.env.PUBLIC_CLOUD_PORTAL_URL,
        sessionCookieDomain: process.env.PUBLIC_SESSION_COOKIE_DOMAIN,
    };
}

/** The built index.html, carrying the config as a global. */
function buildShell(root: string): string {
    // Escaped so that no value can close the script tag it sits in.
    const config = JSON.stringify(publicConfig()).replace(/</g, '\\u003c');

    const html = readFileSync(path.join(root, 'index.html'), 'utf8');

    const head = html.match(/<head[^>]*>/);

    if (!head)
        throw new Error(`${root}/index.html has no <head> to place the config in`);

    // First in the document, so it is set before any script reads it.
    return html.replace(head[0], `${head[0]}<script>window.__PRETZEL__=${config}</script>`);
}

function isReservedPath(pathname: string): boolean {
    return [...API_PREFIXES, ASSET_PREFIX]
        .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Serves the built editor from FRONTEND_ROOT. Null when it is unset. */
export function frontendMiddleware(): RequestHandler | null {
    const root = process.env.FRONTEND_ROOT;

    if (!root)
        return null;

    // Rebuilt when index.html changes, so a rebuilt bundle is served without a restart.
    let cached: { mtimeMs: number; html: string } = {
        mtimeMs: statSync(path.join(root, 'index.html')).mtimeMs,
        html:    buildShell(root),
    };

    const getShell = (): string => {
        const { mtimeMs } = statSync(path.join(root, 'index.html'));

        if (mtimeMs !== cached.mtimeMs)
            cached = { mtimeMs, html: buildShell(root) };

        return cached.html;
    };

    const router = express.Router();

    // Hashed filenames, so a name never comes to mean different bytes.
    router.use(ASSET_PREFIX, express.static(path.join(root, 'assets'), {
        immutable: true,
        maxAge: '1y',
    }));

    router.use(express.static(root, { index: false }));

    router.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            next();
            return;
        }

        if (isReservedPath(req.path)) {
            next();
            return;
        }

        res.type('html').set('Cache-Control', 'no-store').send(getShell());
    });

    return router;
}
