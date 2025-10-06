import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { isNil } from "lodash";
import {
  getSenderLid,
  jidNormalizedUser,
  toJid,
  WAMessage,
  WASocket
} from "baileys";
import { logger } from "../../utils/logger";
import { Op } from "sequelize";
interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  isGroup: boolean;
  email?: string;
  profilePicUrl?: string;
  companyId: number;
  extraInfo?: ExtraInfo[];
  whatsappId?: number;
  msg?: WAMessage;
}

const CreateOrUpdateContactService = async ({
  name,
  number,
  profilePicUrl,
  isGroup,
  email = "",
  companyId,
  extraInfo = [],
  whatsappId,
  msg
}: Request): Promise<Contact> => {
  const cleanNumber = number.replace(/\D/g, "");
  const normalizedJid = jidNormalizedUser(number);
  const senderLid = msg
    ? getSenderLid(msg)
    : { lid: undefined, jid: normalizedJid };
  const jid = toJid(senderLid.lid || senderLid.jid);

  const contactIdentifiers = {
    contactId: jid,
    lid: senderLid.lid,
    phoneNumber: jid.replace(/\D/g, "")
  };

  const io = getIO();
  let contact: Contact | null;

  contact = await Contact.findOne({
    where: {
      [Op.or]: [
        {
          contactId: {
            [Op.in]: [jid, normalizedJid, cleanNumber, number]
          }
        },
        {
          lid: {
            [Op.in]: [jid, normalizedJid, cleanNumber, number]
          }
        },
        { number: cleanNumber },
        { phoneNumber: cleanNumber }
      ],
      companyId
    }
  });

  if (contact) {
    contact.update({
      profilePicUrl,
      number: contactIdentifiers.phoneNumber || cleanNumber,
      contactId: contactIdentifiers.contactId,
      lid: contactIdentifiers.lid,
      phoneNumber: contactIdentifiers.phoneNumber
    });
    if (isNil(contact.whatsappId === null)) {
      contact.update({
        whatsappId
      });
    }
    io.emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });
  } else {
    contact = await Contact.create({
      name,
      number: cleanNumber,
      profilePicUrl,
      email,
      isGroup,
      extraInfo,
      companyId,
      whatsappId,
      contactId: contactIdentifiers.contactId,
      lid: contactIdentifiers.lid,
      phoneNumber: contactIdentifiers.phoneNumber
    });

    io.emit(`company-${companyId}-contact`, {
      action: "create",
      contact
    });
  }

  return contact;
};

export default CreateOrUpdateContactService;
