// @ts-expect-error: tipos do @upstash/redis podem variar por versão
import { createUpstashRedis } from "@upstash/redis";

export const redis = createUpstashRedis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});