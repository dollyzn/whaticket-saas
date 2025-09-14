import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { isPnUser, getContactIdentifiers } from "../../helpers/LidPnMapping";

const CheckIsValidContact = async (
  number: string,
  companyId: number
): Promise<void> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  const wbot = getWbot(defaultWhatsapp.id);

  try {
    const isValidNumber = await wbot.onWhatsApp(`${number}`);
    if (!isValidNumber || isValidNumber.length === 0) {
      throw new AppError("invalidNumber");
    }

    // Check if we got valid contact info
    const contactInfo = isValidNumber[0];
    if (!contactInfo || !contactInfo.jid) {
      throw new AppError("invalidNumber");
    }
  } catch (err: any) {
    if (err.message === "invalidNumber") {
      throw new AppError("ERR_WAPP_INVALID_CONTACT");
    }
    throw new AppError("ERR_WAPP_CHECK_CONTACT");
  }
};

export default CheckIsValidContact;
