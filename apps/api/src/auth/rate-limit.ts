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
 * Lazily initialized to allow module loading without Redis.
 */
let loginLimiter: RateLimiterRedis | null = null;
function getLoginLimiter(): RateLimiterRedis | null {
  if (loginLimiter) return loginLimiter;

  try {
    const redis = getRedisClient();
    loginLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:login",
      points: 5, // 5 attempts
      duration: 15 * 60, // 15 minutes
      blockDuration: 15 * 60, // Block for 15 minutes
    });
    return loginLimiter;
  } catch (err) {
    // Redis not configured - return null for graceful degradation
    return null;
  }
}

/**
 * Registration rate limiter: 3 attempts per hour per IP.
 * Blocks for 1 hour on limit exceeded.
 * Lazily initialized to allow module loading without Redis.
 */
let registrationLimiter: RateLimiterRedis | null = null;
function getRegistrationLimiter(): RateLimiterRedis | null {
  if (registrationLimiter) return registrationLimiter;

  try {
    const redis = getRedisClient();
    registrationLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:registration",
      points: 3, // 3 attempts
      duration: 60 * 60, // 1 hour
      blockDuration: 60 * 60, // Block for 1 hour
    });
    return registrationLimiter;
  } catch (err) {
    // Redis not configured - return null for graceful degradation
    return null;
  }
}

/**
 * Token refresh rate limiter: 10 attempts per minute per userId.
 * Blocks for 1 minute on limit exceeded.
 * Lazily initialized to allow module loading without Redis.
 */
let refreshLimiter: RateLimiterRedis | null = null;
function getRefreshLimiter(): RateLimiterRedis | null {
  if (refreshLimiter) return refreshLimiter;

  try {
    const redis = getRedisClient();
    refreshLimiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: "rl:refresh",
      points: 10, // 10 attempts
      duration: 60, // 1 minute
      blockDuration: 60, // Block for 1 minute
    });
    return refreshLimiter;
  } catch (err) {
    // Redis not configured - return null for graceful degradation
    return null;
  }
}

/**
 * Check login rate limit (username + IP).
 *
 * @param email - User email (case-insensitive)
 * @param ip - Client IP address
 * @throws TRPCError with code TOO_MANY_REQUESTS if limit exceeded
 */
export async function checkLoginRateLimit(email: string, ip: string): Promise<void> {
  const limiter = getLoginLimiter();

  if (!limiter) {
    // Redis not available - fail open
    console.warn("Login rate limiting unavailable (Redis not configured)");
    return;
  }

  try {
    const key = `${email.toLowerCase()}:${ip}`;
    await limiter.consume(key);
  } catch (err) {
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
  const limiter = getRegistrationLimiter();

  if (!limiter) {
    // Redis not available - fail open
    console.warn("Registration rate limiting unavailable (Redis not configured)");
    return;
  }

  try {
    await limiter.consume(ip);
  } catch (err) {
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
  const limiter = getRefreshLimiter();

  if (!limiter) {
    // Redis not available - fail open
    console.warn("Refresh rate limiting unavailable (Redis not configured)");
    return;
  }

  try {
    await limiter.consume(userId);
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many refresh attempts. Try again in ${Math.ceil(err.msBeforeNext / 1000)} seconds.`,
      });
    }

    console.error("Rate limit check failed:", err);
  }
}
