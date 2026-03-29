import {
  INestApplication,
  RequestMethod,
  VersioningType,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

export const CURRENT_API_VERSION = '1';
export const NEXT_API_VERSION = '2';

const VERSIONED_ROUTE_PREFIX = /^\/v\d+(\/|$)/i;
const LEGACY_COMPATIBILITY_EXCLUSIONS = ['/uploads'];

export function configureGlobalApiVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: CURRENT_API_VERSION,
  });

  // Preserve legacy unversioned clients by internally routing them to v1.
  app.use(createLegacyVersionRewriteMiddleware());
}

export function createLegacyVersionRewriteMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!shouldRewriteLegacyPath(req.path, req.method)) {
      return next();
    }

    req.url = buildVersionedUrl(req.url, CURRENT_API_VERSION);
    next();
  };
}

export function shouldRewriteLegacyPath(
  path: string,
  method?: string,
): boolean {
  if (!path.startsWith('/')) {
    return false;
  }

  if (
    method &&
    method.toUpperCase() === RequestMethod[RequestMethod.OPTIONS]
  ) {
    return false;
  }

  if (VERSIONED_ROUTE_PREFIX.test(path)) {
    return false;
  }

  return !LEGACY_COMPATIBILITY_EXCLUSIONS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function buildVersionedUrl(url: string, version: string): string {
  if (!url.startsWith('/')) {
    return url;
  }

  return url === '/' ? `/v${version}/` : `/v${version}${url}`;
}
