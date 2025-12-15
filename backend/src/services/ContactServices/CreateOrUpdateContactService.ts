import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import { isNil } from "lodash";
import { jidNormalizedUser, proto } from "baileys";
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
  msg?: proto.IWebMessageInfo;
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

  const contactIdentifiers = {
    contactId: normalizedJid,
    phoneNumber: cleanNumber
  };

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
