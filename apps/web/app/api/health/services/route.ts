import { NextResponse } from 'next/server';

/**
 * Server-side health check for Python microservices.
 * Uses Docker internal hostnames — never exposes internal ports to the browser.
 * Called by the observability dashboard instead of browser-direct localhost fetches.
 */

interface ServiceResult {
  name: string;
  port: number;
  status: 'active' | 'unreachable';
  responseMs: number;
}

const SERVICES = [
  {
    name: 'AI Service',
    port: 8001,
    url: process.env.AI_INTERNAL_URL || 'http://ai-service:8000',
  },
  {
    name: 'Intent Parser',
    port: 8002,
    url: 'http://intent-parser:8000',
  },
  {
    name: 'Product Aggregator',
    port: 8003,
    url: 'http://product-aggregator:8000',
  },
  {
    name: 'Product Ranking Engine',
    port: 8004,
    url: process.env.RANKING_SERVICE_URL || 'http://product-ranking-engine:8000',
  },
] as const;

export async function GET(): Promise<NextResponse<ServiceResult[]>> {
  const results = await Promise.all(
    SERVICES.map(async (svc): Promise<ServiceResult> => {
      const start = Date.now();
      try {
        const res = await fetch(`${svc.url}/health`, {
          signal: AbortSignal.timeout(5000),
          // Server-side fetch — no CORS headers needed
          cache: 'no-store',
        });
        return {
          name: svc.name,
          port: svc.port,
          status: res.ok ? 'active' : 'unreachable',
          responseMs: Date.now() - start,
        };
      } catch {
        return {
          name: svc.name,
          port: svc.port,
          status: 'unreachable',
          responseMs: Date.now() - start,
        };
      }
    }),
  );

  return NextResponse.json(results);
}
