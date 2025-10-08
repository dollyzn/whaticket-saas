import { sentCache } from "../libs/wbot";
import { logger } from "../utils/logger";
import {
  AnyMessageContent,
  MiscMessageGenerationOptions,
  WAMessage,
  WASocket
} from "baileys";

/**
 * Envia uma mensagem via WhatsApp usando uma sessão (WASocket).
 *
 * @param wbot - Sessão ativa do Baileys (socket)
 * @param chatId - JID do destinatário (ex: "5511999999999@s.whatsapp.net")
 * @param content - Conteúdo da mensagem (texto, mídia, template, etc.)
 * @param options - (Opcional) opções adicionais de envio (quoted, mentions, etc.)
 * @returns Mensagem enviada (WAMessage) ou null em caso de falha
 */
export const SendWhatsAppMessage = async (
  wbot: WASocket,
  chatId: string,
  content: AnyMessageContent,
  options?: MiscMessageGenerationOptions
): Promise<WAMessage> => {
  try {
    const sent = await wbot.sendMessage(chatId, content, options);

    if (sent?.key?.id) {
      sentCache.set(sent.key.id, sent.message);
    }

    return sent;
  } catch (err) {
    logger.error(
      `[WAPP:${wbot.user.name}] Falha ao enviar mensagem: ${err.message}`
    );
    throw err;
  }
};
