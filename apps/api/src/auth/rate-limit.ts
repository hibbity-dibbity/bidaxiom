import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import Redis from "ioredis";
import { TRPCError } from "@trpc/server";

/**
 * Redis-backed rate limiters for authentication endpoints.
 *
 * Rate limiting protects against brute force attacks and abuse.
 * Falls back gracefully when Redis is unavailable (logs warning, allows request).
 */

// Lazy Redis client initialization (same pattern as DB pool)
let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.warn("REDIS_URL not configured - rate limiting disabled");
      throw new Error("Redis not configured");
    }

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ, safe for rate limiting
      enableOfflineQueue: false, // Fail fast if Redis is down
    });

    redisClient.on("error", (err) => {
      console.error("Redis error:", err);
    });
  }

  return redisClient;
}

/**
 * Login rate limiter: 5 attempts per 15 minutes per username+IP.
 * Blocks for 15 minutes on limit exceeded.
 */
const loginLimiter = new RateLimiterRedis({
  storeClient: getRedisClient(),
  keyPrefix: "rl:login",
  points: 5, // 5 attempts
  duration: 15 * 60, // 15 minutes
  blockDuration: 15 * 60, // Block for 15 minutes
});

/**
 * Registration rate limiter: 3 attempts per hour per IP.
 * Blocks for 1 hour on limit exceeded.
 */
const registrationLimiter = new RateLimiterRedis({
  storeClient: getRedisClient(),
  keyPrefix: "rl:registration",
  points: 3, // 3 attempts
  duration: 60 * 60, // 1 hour
  blockDuration: 60 * 60, // Block for 1 hour
});

/**
 * Token refresh rate limiter: 10 attempts per minute per userId.
 * Blocks for 1 minute on limit exceeded.
 */
const refreshLimiter = new RateLimiterRedis({
  storeClient: getRedisClient(),
  keyPrefix: "rl:refresh",
  points: 10, // 10 attempts
  duration: 60, // 1 minute
  blockDuration: 60, // Block for 1 minute
});

/**
 * Check login rate limit (username + IP).
 *
 * @param email - User email (case-insensitive)
 * @param ip - Client IP address
 * @throws TRPCError with code TOO_MANY_REQUESTS if limit exceeded
 */
export async function checkLoginRateLimit(email: string, ip: string): Promise<void> {
  try {
    const key = `${email.toLowerCase()}:${ip}`;
    await loginLimiter.consume(key);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not configured")) {
      // Redis not available - log warning and allow request
      console.warn("Rate limiting unavailable (Redis not configured)");
      return;
    }

    if (err instanceof RateLimiterRes) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many login attempts. Try again in ${Math.ceil(err.msBeforeNext / 1000)} seconds.`,
      });
    }

    // Other errors - log and allow request (fail open)
    console.error("Rate limit check failed:", err);
  }
}

/**
 * Check registration rate limit (IP only).
 *
 * @param ip - Client IP address
 * @throws TRPCError with code TOO_MANY_REQUESTS if limit exceeded
 */
export async function checkRegistrationRateLimit(ip: string): Promise<void> {
  try {
    await registrationLimiter.consume(ip);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not configured")) {
      console.warn("Rate limiting unavailable (Redis not configured)");
      return;
    }

    if (err instanceof RateLimiterRes) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many registration attempts. Try again in ${Math.ceil(err.msBeforeNext / 1000)} seconds.`,
      });
    }

    console.error("Rate limit check failed:", err);
  }
}

/**
 * Check token refresh rate limit (userId).
 *
 * @param userId - User ID
 * @throws TRPCError with code TOO_MANY_REQUESTS if limit exceeded
 */
export async function checkRefreshRateLimit(userId: string): Promise<void> {
  try {
    await refreshLimiter.consume(userId);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not configured")) {
      console.warn("Rate limiting unavailable (Redis not configured)");
      return;
    }

    if (err instanceof RateLimiterRes) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many refresh attempts. Try again in ${Math.ceil(err.msBeforeNext / 1000)} seconds.`,
      });
    }

    console.error("Rate limit check failed:", err);
  }
}
