import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../env';

function readToken(req: Request): string {
  const headerToken = req.header('x-dashboard-access-token');
  if (headerToken) return headerToken;

  const authorization = req.header('authorization');
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  return '';
}

function tokensMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function requireDashboardAccess(req: Request, res: Response, next: NextFunction) {
  const expectedToken = env.DASHBOARD_ACCESS_TOKEN.trim();
  if (!expectedToken) return next();

  if (tokensMatch(readToken(req), expectedToken)) return next();

  return res.status(401).json({ error: 'Bonjou demo password required' });
}
