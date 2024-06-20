import moment from "moment";
import * as Sentry from "@sentry/node";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import ShowTicketService from "./ShowTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { verifyMessage } from "../WbotServices/wbotMessageListener";
import ListSettingsServiceOne from "../SettingServices/ListSettingsServiceOne";
import ShowUserService from "../UserServices/ShowUserService";
import { isNil } from "lodash";

interface TicketData {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  chatbot?: boolean;
  queueOptionId?: number;
  whatsappId?: string;
  useIntegration?: boolean;
  integrationId?: number | null;
  promptId?: number | null;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
  companyId: number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  companyId
}: Request): Promise<Response> => {
  try {
    const { status } = ticketData;
    let { queueId, userId, whatsappId } = ticketData;
    let chatbot: boolean | null = ticketData.chatbot || false;
    let queueOptionId: number | null = ticketData.queueOptionId || null;

    const io = getIO();

    const ticket = await ShowTicketService(ticketId, companyId);
    const ticketTraking = await FindOrCreateATicketTrakingService({
      ticketId,
      companyId,
      whatsappId: ticket.whatsappId
    });

    if (isNil(whatsappId)) {
      whatsappId = ticket.whatsappId?.toString();
    }

    await SetTicketMessagesAsRead(ticket);

    const oldStatus = ticket.status;
    const oldUserId = ticket.user?.id;
    const oldQueueId = ticket.queueId;

    if (
      oldStatus === "closed" ||
      (whatsappId && Number(whatsappId) !== ticket.whatsappId)
    ) {
      await CheckContactOpenTickets(ticket.contact.id, whatsappId);
      chatbot = null;
      queueOptionId = null;
    }

    if (status === "closed") {
      const { complationMessage, ratingMessage } = ticket.whatsappId
        ? await ShowWhatsAppService(ticket.whatsappId, companyId)
        : { complationMessage: null, ratingMessage: null };

      const settingEvaluation = await ListSettingsServiceOne({
        companyId: companyId,
        key: "userRating"
      });

      if (settingEvaluation?.value === "enabled") {
        if (ticketTraking.ratingAt == null && ticketTraking.userId !== null) {
          const bodyRatingMessage = `${
            ratingMessage ? ratingMessage + "\n\n" : ""
          }Digite de 1 a 5 para qualificar nosso atendimento:\n\n*5* - 😊 _Ótimo_\n*4* - 🙂 _Bom_\n*3* - 😐 _Neutro_\n*2* - 😕 _Ruim_\n*1* - 😞 _Péssimo_`;

          await SendWhatsAppMessage({ body: bodyRatingMessage, ticket });

          await ticketTraking.update({
            ratingAt: moment().toDate()
          });
        }
        ticketTraking.ratingAt = moment().toDate();
        ticketTraking.rated = false;
      } else {
        ticketTraking.finishedAt = moment().toDate();

        if (!isNil(complationMessage) && complationMessage !== "") {
          const body = `\u200e${complationMessage}`;
          await SendWhatsAppMessage({ body, ticket });
        }
      }

      await ticket.update({
        promptId: null,
        integrationId: null,
        useIntegration: false,
        typebotStatus: false,
        typebotSessionId: null
      });

      ticketTraking.whatsappId = ticket.whatsappId;
      ticketTraking.userId = ticket.userId;
    }

    if (queueId !== undefined && queueId !== null) {
      ticketTraking.queuedAt = moment().toDate();
    }

    const settingsTransfTicket = await ListSettingsServiceOne({
      companyId: companyId,
      key: "sendMsgTransfTicket"
    });

    if (settingsTransfTicket?.value === "enabled") {
      if (
        oldQueueId !== queueId &&
        oldUserId === userId &&
        !isNil(oldQueueId) &&
        !isNil(queueId)
      ) {
        const queue = await Queue.findByPk(queueId);
        const wbot = await GetTicketWbot(ticket);
        const msgtxt = `*Mensagem automática*:\nVocê foi transferido para o departamento *${queue?.name}*\nAguarde um momento, por favor. Iremos te atender em breve!`;

        const queueChangedMessage = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          { text: msgtxt }
        );
        await verifyMessage(queueChangedMessage, ticket, ticket.contact);
      } else if (
        oldUserId !== userId &&
        oldQueueId === queueId &&
        !isNil(oldUserId) &&
        !isNil(userId)
      ) {
        const wbot = await GetTicketWbot(ticket);
        const nome = await ShowUserService(ticketData.userId);
        const msgtxt = `*Mensagem automática*:\nVocê foi transferido para o atendente *${nome.name}*.\nAguarde um momento, por favor. Iremos te atender em breve!`;

        const queueChangedMessage = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          { text: msgtxt }
        );
        await verifyMessage(queueChangedMessage, ticket, ticket.contact);
      } else if (
        oldUserId !== userId &&
        !isNil(oldUserId) &&
        !isNil(userId) &&
        oldQueueId !== queueId &&
        !isNil(oldQueueId) &&
        !isNil(queueId)
      ) {
        const wbot = await GetTicketWbot(ticket);
        const queue = await Queue.findByPk(queueId);
        const nome = await ShowUserService(ticketData.userId);
        const msgtxt = `*Mensagem automática*:\nVocê foi transferido para o departamento *${queue?.name}* e será atendido por *${nome.name}*.\nAguarde um momento, por favor. Iremos te atender em breve!`;

        const queueChangedMessage = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          { text: msgtxt }
        );
        await verifyMessage(queueChangedMessage, ticket, ticket.contact);
      } else if (
        oldUserId !== undefined &&
        isNil(userId) &&
        oldQueueId !== queueId &&
        !isNil(queueId)
      ) {
        const queue = await Queue.findByPk(queueId);
        const wbot = await GetTicketWbot(ticket);
        const msgtxt = `*Mensagem automática*:\nVocê foi transferido para o departamento *${queue?.name}*\nAguarde um momento, por favor. Iremos te atender em breve!`;

        const queueChangedMessage = await wbot.sendMessage(
          `${ticket.contact.number}@${
            ticket.isGroup ? "g.us" : "s.whatsapp.net"
          }`,
          { text: msgtxt }
        );
        await verifyMessage(queueChangedMessage, ticket, ticket.contact);
      }
    }

    await ticket.update({
      status,
      queueId,
      userId,
      whatsappId,
      chatbot,
      queueOptionId
    });

    await ticket.reload();

    if (status === "pending") {
      await ticketTraking.update({
        whatsappId,
        queuedAt: moment().toDate(),
        startedAt: null,
        userId: null
      });
    }

    if (status === "open") {
      await ticketTraking.update({
        startedAt: moment().toDate(),
        ratingAt: null,
        rated: false,
        whatsappId,
        userId: ticket.userId
      });
    }

    await ticketTraking.save();

    if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
      io.to(oldStatus).emit(`company-${companyId}-ticket`, {
        action: "delete",
        ticketId: ticket.id
      });
    }

    io.to(ticket.status)
      .to("notification")
      .to(ticketId.toString())
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    return { ticket, oldStatus, oldUserId };
  } catch (err) {
    Sentry.captureException(err);
  }
};

export default UpdateTicketService;
