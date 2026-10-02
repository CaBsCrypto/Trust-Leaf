import type { ErrorRequestHandler } from 'express';

const categories = new Map<string, readonly [number, string]>([
  ['entity.parse.failed', [400, 'REQUEST_BODY_INVALID']],
  ['request.aborted', [400, 'REQUEST_BODY_INVALID']],
  ['request.size.invalid', [400, 'REQUEST_BODY_INVALID']],
  ['entity.verify.failed', [403, 'REQUEST_BODY_REJECTED']],
  ['entity.too.large', [413, 'REQUEST_BODY_TOO_LARGE']],
  ['encoding.unsupported', [415, 'REQUEST_BODY_UNSUPPORTED']],
  ['charset.unsupported', [415, 'REQUEST_BODY_UNSUPPORTED']],
  ['stream.encoding.set', [500, 'REQUEST_BODY_UNAVAILABLE']],
  ['stream.not.readable', [500, 'REQUEST_BODY_UNAVAILABLE']],
]);

export const handleExpressParserError: ErrorRequestHandler = (error, _req, res, next) => {
  const type = error && typeof error === 'object' ? error.type : undefined;
  const category = typeof type === 'string' ? categories.get(type) : undefined;
  if (!category) return next(error);
  // Forwarding the original parser error lets finalhandler log private body text.
  if (res.destroyed || res.writableEnded || res.socket?.destroyed) return;
  if (res.headersSent) { res.destroy(); return; }
  res.setHeader('Cache-Control', 'no-store, private');
  res.status(category[0]).json({ code: category[1] });
};
