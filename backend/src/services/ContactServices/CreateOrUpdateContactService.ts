import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { isNil } from "lodash";
import { getContactIdentifiers } from "../../helpers/LidPnMapping";
import { WASocket } from "baileys";
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

  let contactIdentifiers: {
    contactId: string;
    lid?: string;
    phoneNumber?: string;
  } = { contactId: number };

  if (wbot && !isGroup) {
    try {
      contactIdentifiers = await getContactIdentifiers(wbot, number);
    } catch (error) {
      logger.error("Error getting contact identifiers:", error);
    }
  }

  const io = getIO();
  let contact: Contact | null;

  contact = await Contact.findOne({
    where: {
      [Op.or]: [
        { number: cleanNumber },
        { contactId: number },
        { lid: number },
        { phoneNumber: cleanNumber }
      ],
      companyId
    }
  });

  if (contact) {
    contact.update({
      profilePicUrl,
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
