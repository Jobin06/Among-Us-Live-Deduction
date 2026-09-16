interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

/**
 * Rate Limiter for Login Endpoints:
 * Strictly enforces 5 failed attempts per 15 minutes per IP/username.
 * Complies with Revision 3.1 security requirements with zero unapproved secondary policies.
 */
export class LoginRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  public readonly maxAttempts = 5;
  public readonly windowMs = 15 * 60 * 1000; // 15 minutes

  constructor() {
    // Periodic cleanup of expired records every 5 minutes
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => {
        const now = Date.now();
        this.records.forEach((record, key) => {
          if (now > record.resetAt) {
            this.records.delete(key);
          }
        });
      }, 5 * 60 * 1000);
      if (timer.unref) {
        timer.unref();
      }
    }
  }

  /**
   * Generates the rate-limiting key based on IP and username.
   * If IP is absent or unknown, falls back to the normalized identifier.
   */
  public getKey(identifier: string, ip?: string): string {
    const normId = identifier.toLowerCase().trim();
    const normIp = ip && ip !== "unknown" ? ip.trim() : "";
    return normIp ? `${normIp}:${normId}` : normId;
  }

  /**
   * Checks whether the given IP/username is permitted to attempt login.
   */
  public check(identifier: string, ip?: string): { allowed: boolean; remaining: number; resetAt: number; reason?: string } {
    const key = this.getKey(identifier, ip);
    const now = Date.now();
    const record = this.records.get(key);

    if (!record || now > record.resetAt) {
      return {
        allowed: true,
        remaining: this.maxAttempts,
        resetAt: now + this.windowMs,
      };
    }

    const remaining = Math.max(0, this.maxAttempts - record.attempts);
    const allowed = record.attempts < this.maxAttempts;
    return {
      allowed,
      remaining,
      resetAt: record.resetAt,
      reason: allowed ? undefined : "Too many failed attempts. Please try again in 15 minutes.",
    };
  }

  /**
   * Records a failed attempt for the IP/username key.
   */
  public recordAttempt(identifier: string, ip?: string): void {
    const key = this.getKey(identifier, ip);
    const now = Date.now();
    let record = this.records.get(key);

    if (!record || now > record.resetAt) {
      record = {
        attempts: 1,
        resetAt: now + this.windowMs,
      };
      this.records.set(key, record);
    } else {
      record.attempts += 1;
    }
  }

  /**
   * Resets the attempt counter on successful login for the IP/username key.
   */
  public reset(identifier: string, ip?: string): void {
    const key = this.getKey(identifier, ip);
    this.records.delete(key);
  }

  /**
   * Clears all rate limiter records (useful in test cleanup).
   */
  public resetAll(): void {
    this.records.clear();
  }
}

// Global login rate limiter instance
export const loginRateLimiter = new LoginRateLimiter();
