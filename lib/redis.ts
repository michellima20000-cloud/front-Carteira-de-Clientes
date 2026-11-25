import { Redis } from '@upstash/redis';

// Cliente Upstash Redis (REST). Lê UPSTASH_REDIS_REST_URL e
// UPSTASH_REDIS_REST_TOKEN do ambiente quando disponíveis.
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;
