import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { isNil } from "lodash";
import { getContactIdentifiers } from "../../helpers/LidPnMapping";
import { jidNormalizedUser, WASocket } from "baileys";
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
  wbot?: WASocket; // For LID/PN mapping
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
  wbot
}: Request): Promise<Contact> => {
  const cleanNumber = number.replace(/\D/g, "");
  const normalizedJid = jidNormalizedUser(number);

  let contactIdentifiers: {
    contactId: string;
    lid?: string;
    phoneNumber?: string;
  } = { contactId: normalizedJid };

  if (wbot && !isGroup) {
    try {
      contactIdentifiers = await getContactIdentifiers(wbot, normalizedJid);
    } catch (error) {
      logger.error("Error getting contact identifiers:", error);
    }
  }

  const io = getIO();
  let contact: Contact | null;

  contact = await Contact.findOne({
    where: {
      [Op.or]: [
        {
          contactId: {
            [Op.in]: [normalizedJid, cleanNumber, number]
          }
        },
        {
          lid: {
            [Op.in]: [normalizedJid, cleanNumber, number]
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
