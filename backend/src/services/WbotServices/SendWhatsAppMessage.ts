import { WAMessage } from "baileys";
import WALegacySocket from "baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { getPreferredJid } from "../../helpers/LidPnMapping";

import formatBody from "../../helpers/Mustache";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await GetTicketWbot(ticket);

  // Use preferred JID (LID or PN) for the contact
  let number =
    ticket.contact.contactId ||
    `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

  // Try to get preferred JID for non-group chats
  if (!ticket.isGroup) {
    try {
      // Use contactId if available, otherwise fall back to number
      if (ticket.contact.contactId) {
        number = ticket.contact.contactId;
      } else {
        number = await getPreferredJid(wbot, number);
      }
    } catch (error) {
      console.error("Error getting preferred JID:", error);
      // Keep original number format as fallback
    }
  }

  if (quotedMsg) {
    const chatMessages = await Message.findOne({
      where: {
        id: quotedMsg.id
      }
    });

    if (chatMessages) {
      const msgFound = JSON.parse(chatMessages.dataJson);

      options = {
        quoted: {
          key: msgFound.key,
          message: {
            extendedTextMessage: msgFound.message.extendedTextMessage
          }
        }
      };
    }
  }

  try {
    const sentMessage = await wbot.sendMessage(
      number,
      {
        text: formatBody(body, ticket.contact)
      },
      {
        ...options
      }
    );
    await ticket.update({ lastMessage: formatBody(body, ticket.contact) });
    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
