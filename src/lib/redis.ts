import Redis from "ioredis";

export interface Kv {
  readonly isRedis: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
  setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  hset(key: string, field: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  rpush(key: string, value: string): Promise<void>;
  lpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  llen(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrevrange(key: string, start: number, stop: number): Promise<string[]>;
  zscore(key: string, member: string): Promise<number | null>;
}

class RedisKv implements Kv {
  readonly isRedis = true;
  constructor(private readonly client: Redis) {}

  async get(key: string) {
    if (!key) return null;
    return this.client.get(key);
  }
  async set(key: string, value: string) {
    if (!key) return;
    await this.client.set(key, String(value ?? ""));
  }
  async setex(key: string, ttlSeconds: number, value: string) {
    if (!key) return;
    await this.client.setex(key, ttlSeconds, String(value ?? ""));
  }
  async setnx(key: string, value: string, ttlSeconds?: number) {
    if (!key) return false;
    const val = String(value ?? "");
    const res =
      ttlSeconds !== undefined
        ? await this.client.set(key, val, "EX", ttlSeconds, "NX")
        : await this.client.set(key, val, "NX");
    return res === "OK";
  }
  async del(key: string) {
    if (!key) return;
    await this.client.del(key);
  }
  async exists(key: string) {
    if (!key) return false;
    return (await this.client.exists(key)) === 1;
  }
  async hset(key: string, field: string, value: string) {
    if (!key || !field || value === undefined || value === null) return;
    await this.client.hset(key, field, String(value));
  }
  async hget(key: string, field: string) {
    if (!key || !field) return null;
    return this.client.hget(key, field);
  }
  async hgetall(key: string) {
    if (!key) return {};
    return this.client.hgetall(key);
  }
  async rpush(key: string, value: string) {
    if (!key || value === undefined || value === null) return;
    await this.client.rpush(key, String(value));
  }
  async lpop(key: string) {
    if (!key) return null;
    return this.client.lpop(key);
  }
  async lrange(key: string, start: number, stop: number) {
    if (!key) return [];
    return this.client.lrange(key, start, stop);
  }
  async ltrim(key: string, start: number, stop: number) {
    if (!key) return;
    await this.client.ltrim(key, start, stop);
  }
  async llen(key: string) {
    if (!key) return 0;
    return this.client.llen(key);
  }
  async zadd(key: string, score: number, member: string) {
    if (!key || !member) return;
    await this.client.zadd(key, score, String(member));
  }
  async zrevrange(key: string, start: number, stop: number) {
    if (!key) return [];
    return this.client.zrevrange(key, start, stop);
  }
  async zscore(key: string, member: string) {
    if (!key || !member) return null;
    const res = await this.client.zscore(key, member);
    return res === null ? null : Number(res);
  }
}

interface MemoryEntry {
  value: string;
  expiresAt?: number;
}

class MemoryKv implements Kv {
  readonly isRedis = false;
  private readonly store = new Map<string, MemoryEntry>();
  private readonly lists = new Map<string, string[]>();
  private readonly zsets = new Map<string, Map<string, number>>();

  private isExpired(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  private prune(key: string) {
    if (this.isExpired(key)) this.store.delete(key);
  }

  async get(key: string) {
    this.prune(key);
    return this.store.get(key)?.value ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, { value });
  }
  async setex(key: string, ttlSeconds: number, value: string) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
  async setnx(key: string, value: string, ttlSeconds?: number) {
    this.prune(key);
    if (this.store.has(key)) return false;
    if (ttlSeconds !== undefined) {
      await this.setex(key, ttlSeconds, value);
    } else {
      await this.set(key, value);
    }
    return true;
  }
  async del(key: string) {
    this.store.delete(key);
    this.lists.delete(key);
    this.zsets.delete(key);
  }
  async exists(key: string) {
    this.prune(key);
    return this.store.has(key) || this.lists.has(key) || this.zsets.has(key);
  }
  async hset(key: string, field: string, value: string) {
    const existing = this.store.get(key)?.value;
    const hash: Record<string, string> = existing ? JSON.parse(existing) : {};
    hash[field] = value;
    this.store.set(key, { value: JSON.stringify(hash) });
  }
  async hget(key: string, field: string) {
    this.prune(key);
    const existing = this.store.get(key)?.value;
    if (!existing) return null;
    try {
      const hash = JSON.parse(existing);
      return hash[field] ?? null;
    } catch {
      return null;
    }
  }
  async hgetall(key: string) {
    this.prune(key);
    const existing = this.store.get(key)?.value;
    if (!existing) return {};
    try {
      return JSON.parse(existing);
    } catch {
      return {};
    }
  }
  async rpush(key: string, value: string) {
    const list = this.lists.get(key) ?? [];
    list.push(value);
    this.lists.set(key, list);
  }
  async lpop(key: string) {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.shift() ?? null;
  }
  async lrange(key: string, start: number, stop: number) {
    const list = this.lists.get(key) ?? [];
    const s = Math.max(0, start);
    const e = stop < 0 ? list.length + stop : Math.min(list.length - 1, stop);
    return list.slice(s, e + 1);
  }
  async ltrim(key: string, start: number, stop: number) {
    const list = this.lists.get(key);
    if (!list) return;
    const s = Math.max(0, start);
    const e = stop < 0 ? list.length + stop : Math.min(list.length - 1, stop);
    this.lists.set(key, list.slice(s, e + 1));
  }
  async llen(key: string) {
    return this.lists.get(key)?.length ?? 0;
  }
  async zadd(key: string, score: number, member: string) {
    const zset = this.zsets.get(key) ?? new Map<string, number>();
    zset.set(member, score);
    this.zsets.set(key, zset);
  }
  async zrevrange(key: string, start: number, stop: number) {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    const entries = [...zset.entries()].sort((a, b) => b[1] - a[1]);
    const s = Math.max(0, start);
    const e = stop < 0 ? entries.length + stop : Math.min(entries.length - 1, stop);
    return entries.slice(s, e + 1).map(([member]) => member);
  }
  async zscore(key: string, member: string) {
    return this.zsets.get(key)?.get(member) ?? null;
  }
}

let kvSingleton: Kv | null = null;

export async function getKv(): Promise<Kv> {
  if (kvSingleton) return kvSingleton;

  const host = process.env.REDIS_HOST || "localhost";
  const port = parseInt(process.env.REDIS_PORT || "6379", 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  try {
    const client = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    await client.connect();
    await client.ping();
    kvSingleton = new RedisKv(client);
    console.log(`[redis] connected to redis://${host}:${port}`);
  } catch {
    kvSingleton = new MemoryKv();
    console.warn(`[redis] unreachable (${host}:${port}), using in-memory chat store fallback`);
  }
  return kvSingleton;
}

export function resetKvForTesting(): void {
  kvSingleton = null;
}
