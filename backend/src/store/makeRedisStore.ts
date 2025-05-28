import Redis from "ioredis";
import { jidNormalizedUser, proto } from "baileys";

interface RedisStoreConfig {
  redis: Redis;
}

const redisKey = (prefix: string, id: string) => `${prefix}:${id}`;

export const makeRedisStore = ({ redis }: RedisStoreConfig) => {
  const bind = (ev: any) => {
    ev.on("messages.upsert", async ({ messages, type }: any) => {
      if (type === "notify" || type === "append") {
        for (const msg of messages) {
          const jid = jidNormalizedUser(msg.key.remoteJid);
          const key = redisKey("messages", jid);

          await redis.rpush(key, JSON.stringify(msg));
          // Optionally trim to N messages
          await redis.ltrim(key, -1000, -1);
        }
      }
    });

    ev.on("contacts.upsert", async (contacts: any[]) => {
      for (const contact of contacts) {
        await redis.hset("contacts", contact.id, JSON.stringify(contact));
      }
    });

    ev.on("chats.upsert", async (chats: any[]) => {
      for (const chat of chats) {
        await redis.hset("chats", chat.id, JSON.stringify(chat));
      }
    });
  };

  const loadMessages = async (
    jid: string,
    count = 25
  ): Promise<proto.IWebMessageInfo[]> => {
    const key = redisKey("messages", jid);
    const raw = await redis.lrange(key, -count, -1);
    return raw.map(str => proto.WebMessageInfo.fromObject(JSON.parse(str)));
  };

  const loadContact = async (jid: string) => {
    const raw = await redis.hget("contacts", jid);
    return raw ? JSON.parse(raw) : null;
  };

  const loadChat = async (jid: string) => {
    const raw = await redis.hget("chats", jid);
    return raw ? JSON.parse(raw) : null;
  };

  return {
    bind,
    loadMessages,
    loadContact,
    loadChat
  };
};
