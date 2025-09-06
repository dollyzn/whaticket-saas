import Redis from "ioredis";
import { REDIS_URI_CONNECTION } from "../config/redis";
import * as crypto from "crypto";

const redis = new Redis(REDIS_URI_CONNECTION);

function encryptParams(params: any) {
  const str = JSON.stringify(params);
  return crypto.createHash("sha256").update(str).digest("base64");
}

export async function setFromParams(
  key: string,
  params: any,
  value: string,
  option?: string,
  optionValue?: string | number
) {
  const finalKey = `${key}:${encryptParams(params)}`;
  if (option !== undefined && optionValue !== undefined) {
    return set(finalKey, value, option, optionValue);
  }
  return set(finalKey, value);
}

export async function getFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return get(finalKey);
}

export async function delFromParams(key: string, params: any) {
  const finalKey = `${key}:${encryptParams(params)}`;
  return del(finalKey);
}

export async function set(
  key: string,
  value: string,
  option?: string,
  optionValue?: string | number
) {
  if (option !== undefined && optionValue !== undefined) {
    return redis.set(key, value, option as any, optionValue);
  }
  return redis.set(key, value);
}

export async function get(key: string) {
  return redis.get(key);
}

export async function getKeys(pattern: string) {
  return redis.keys(pattern);
}

export async function del(key: string) {
  return redis.del(key);
}

export async function delFromPattern(pattern: string) {
  const all = await getKeys(pattern);
  for (const item of all) {
    await del(item);
  }
}

export const cacheLayer = {
  set,
  setFromParams,
  get,
  getFromParams,
  getKeys,
  del,
  delFromParams,
  delFromPattern
};
