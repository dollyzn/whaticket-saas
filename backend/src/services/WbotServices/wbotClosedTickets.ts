import { Op } from "sequelize";
import moment from "moment";

import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import TicketTraking from "../../models/TicketTraking";

import { getIO } from "../../libs/socket";
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { verifyMessage } from "./wbotMessageListener";

interface ICloseTicket {
  ticket: Ticket;
  currentStatus: string;
  body?: string;
}

interface IWhatsappConfig {
  expiresInactiveMessage?: string;
  expiresTicket?: string | number;
}

/**
 * Fecha um ticket alterando status, mensagens não lidas e resetando uso de filas do bot.
 */
const closeTicket = async ({ ticket, body }: ICloseTicket): Promise<void> => {
  const updateData: Partial<Ticket> = {
    status: "closed",
    unreadMessages: 0
  };

  if (body) {
    updateData.lastMessage = body;
    updateData.amountUsedBotQueues = 0;
  }

  await ticket.update(updateData);
};

/**
 * Fecha todos os tickets abertos de uma empresa caso tenham passado do tempo limite de inatividade.
 */
export const ClosedAllOpenTickets = async (
  companyId: number
): Promise<void> => {
  const io = getIO();

  try {
    const { rows: tickets } = await Ticket.findAndCountAll({
      where: { status: { [Op.in]: ["open"] }, companyId },
      order: [["updatedAt", "DESC"]]
    });

    // Mapeia todos os tickets para promessas
    const ticketPromises = tickets.map(async ticket => {
      const showTicket = await ShowTicketService(ticket.id, companyId);
      if (!showTicket) return;

      const whatsapp = await Whatsapp.findByPk(showTicket.whatsappId);
      if (!whatsapp) return;

      const ticketTraking = await TicketTraking.findOne({
        where: {
          ticketId: ticket.id,
          finishedAt: null
        }
      });

      const { expiresInactiveMessage, expiresTicket } = whatsapp;

      if (expiresTicket && Number(expiresTicket) > 0) {
        const bodyExpiresMessageInactive = formatBody(
          `\u200e ${expiresInactiveMessage}`,
          showTicket.contact
        );

        const dataLimite = new Date();
        dataLimite.setMinutes(dataLimite.getMinutes() - Number(expiresTicket));

        if (showTicket.status === "open" && !showTicket.isGroup) {
          const dataUltimaInteracaoChamado = new Date(showTicket.updatedAt);

          if (dataUltimaInteracaoChamado < dataLimite && showTicket.fromMe) {
            // Fecha o ticket
            await closeTicket({
              ticket: showTicket,
              currentStatus: showTicket.status,
              body: bodyExpiresMessageInactive
            });

            // Envia mensagem de encerramento
            if (expiresInactiveMessage) {
              const sentMessage = await SendWhatsAppMessage({
                body: bodyExpiresMessageInactive,
                ticket: showTicket
              });

              await verifyMessage(sentMessage, showTicket, showTicket.contact);
            }

            // Atualiza histórico
            await ticketTraking?.update({
              finishedAt: moment().toDate(),
              closedAt: moment().toDate(),
              whatsappId: ticket.whatsappId,
              userId: ticket.userId
            });

            // Notifica front-end
            io.to("open").emit(`company-${companyId}-ticket`, {
              action: "delete",
              ticketId: showTicket.id
            });
          }
        }
      }
    });

    // Executa todas as promessas em paralelo
    await Promise.all(ticketPromises);
  } catch (error) {
    console.error("Erro ao fechar tickets por inatividade:", error);
  }
};
