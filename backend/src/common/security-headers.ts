import type { NextFunction, Request, Response } from 'express';

/**
 * Security response headers, set explicitly.
 *
 * This replaced `helmet`. Helmet is a good package, but it is published as CommonJS with a
 * single callable export, and calling it from an ESM TypeScript project depends on interop
 * settings that differ between our build and the host's — it compiled here and failed there
 * with "this expression is not callable", which is a miserable thing to debug from a
 * deployment log.
 *
 * The deeper reason to drop it: **most of what helmet does is for pages, and this server does
 * not serve any.** Content-Security-Policy governs what a document may load; there is no
 * document here, only JSON and image bytes. What remains is the handful below, and writing
 * them out is clearer than configuring a package to send four headers.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Do not let a browser second-guess a Content-Type. Without this, a file we serve as an
  // image could be sniffed as something executable.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Nothing here should ever be framed by another site.
  res.setHeader('X-Frame-Options', 'DENY');

  // Never leak the URL a request came from — those can contain share tokens.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // This API is not a browsing context; it has no reason to resolve hosts ahead of time.
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Tell browsers to refuse plain HTTP for a year. Only over HTTPS — sending it on a plain
  // connection is meaningless, and locally it would pin localhost to HTTPS and lock you out
  // of your own dev server.
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Express advertises itself by default. Free information for anyone choosing an exploit.
  res.removeHeader('X-Powered-By');

  next();
}
