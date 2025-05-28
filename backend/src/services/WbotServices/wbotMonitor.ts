import { WASocket, BinaryNode, Contact as BContact } from "baileys";
import * as Sentry from "@sentry/node";

import { Op } from "sequelize";
// import { getIO } from "../../libs/socket";
import { Store } from "../../libs/store";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { logger } from "../../utils/logger";
import createOrUpdateBaileysService from "../BaileysServices/CreateOrUpdateBaileysService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { debounce } from "../../helpers/Debounce";

type Session = WASocket & {
  id?: number;
  store?: Store;
};

interface IContact {
  contacts: BContact[];
}

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  try {
    wbot.ev.on("call", async call => {
      try {
        if (call.length > 0) {
          const sendMsgCall = await Setting.findOne({
            where: { key: "call", companyId }
          });

          if (sendMsgCall.value === "disabled") {
            const callId = call[0].id;
            const from = call[0].from;

            await wbot.rejectCall(callId, from).then(async () => {
              const debouncedSentMessage = debounce(
                async () => {
                  await wbot.sendMessage(from, {
                    text: `*Mensagem Automática:*\nAs chamadas de voz e vídeo estão desabilitadas para este WhatsApp. Por favor, envie uma mensagem de texto.`
                  });

                  const number = from.split(":").shift();

                  const contact = await Contact.findOne({
                    where: { companyId, number }
                  });

                  const ticket = await Ticket.findOne({
                    where: {
                      contactId: contact.id,
                      whatsappId: wbot.id,
                      //status: { [Op.or]: ["close"] },
                      companyId
                    }
                  });
                  // se não existir o ticket não faz nada.
                  if (!ticket) return;

                  const date = new Date();
                  const hours = date.getHours();
                  const minutes = date.getMinutes();

                  const body = `Chamada de voz/vídeo perdida às ${hours}:${minutes}`;
                  const messageData = {
                    id: callId,
                    ticketId: ticket.id,
                    contactId: contact.id,
                    body,
                    fromMe: false,
                    mediaType: "call_log",
                    read: true,
                    quotedMsgId: null,
                    ack: 1
                  };

                  await ticket.update({
                    lastMessage: body
                  });

                  if (ticket.status === "closed") {
                    await ticket.update({
                      status: "pending"
                    });
                  }

                  await CreateMessageService({
                    messageData,
                    companyId: companyId
                  });
                },
                3000,
                Number(callId.replace(/\D/g, ""))
              );
              debouncedSentMessage();
            });
          }
        }
      } catch (error) {
        logger.error("Error handling call:", error);
      }
    });

    wbot.ev.on("contacts.upsert", async (contacts: BContact[]) => {
      await createOrUpdateBaileysService({
        whatsappId: whatsapp.id,
        contacts
      });
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
  }
};

export default wbotMonitor;
