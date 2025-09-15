import { jidNormalizedUser, WASocket } from "baileys";
import { logger } from "../utils/logger";

export interface LidPnMapping {
  lid: string;
  phoneNumber: string;
}

/**
 * Checks if a JID is a Phone Number (PN) format
 * @param jid - The JID to check
 * @returns boolean
 */
export const isPnUser = (jid: string): boolean => {
  return jid.includes("@s.whatsapp.net") && !jid.includes("lid");
};

/**
 * Checks if a JID is a LID (Local Identifier) format
 * @param jid - The JID to check
 * @returns boolean
 */
export const isLidUser = (jid: string): boolean => {
  return jid.includes("lid");
};

/**
 * Gets the LID for a Phone Number using the Baileys store
 * @param wbot - WASocket instance
 * @param phoneNumber - Phone number in format number@s.whatsapp.net
 * @returns Promise<string | null>
 */
export const getLidForPN = async (
  wbot: WASocket,
  phoneNumber: string
): Promise<string | null> => {
  try {
    const store = wbot.signalRepository?.lidMapping;
    if (!store) {
      logger.warn("LID mapping store not available");
      return null;
    }

    return await store.getLIDForPN(phoneNumber);
  } catch (error) {
    logger.error("Error getting LID for PN:", error);
    return null;
  }
};

/**
 * Gets the Phone Number for a LID using the Baileys store
 * @param wbot - WASocket instance
 * @param lid - LID identifier
 * @returns Promise<string | null>
 */
export const getPNForLID = async (
  wbot: WASocket,
  lid: string
): Promise<string | null> => {
  try {
    const store = wbot.signalRepository?.lidMapping;
    if (!store) {
      logger.warn("LID mapping store not available");
      return null;
    }

    return await store.getPNForLID(lid);
  } catch (error) {
    logger.error("Error getting PN for LID:", error);
    return null;
  }
};

/**
 * Stores LID/PN mapping in the Baileys store
 * @param wbot - WASocket instance
 * @param mapping - LID/PN mapping object
 */
export const storeLidPnMapping = async (
  wbot: WASocket,
  mapping: LidPnMapping
): Promise<void> => {
  try {
    const store = wbot.signalRepository?.lidMapping;
    if (!store) {
      logger.warn("LID mapping store not available");
      return;
    }

    await store.storeLIDPNMappings([
      { lid: mapping.lid, pn: mapping.phoneNumber }
    ]);
    logger.info(
      `Stored LID/PN mapping: ${mapping.lid} <-> ${mapping.phoneNumber}`
    );
  } catch (error) {
    logger.error("Error storing LID/PN mapping:", error);
  }
};

/**
 * Gets the preferred JID (LID or PN) for a contact
 * @param wbot - WASocket instance
 * @param jid - Original JID
 * @returns Promise<string>
 */
export const getPreferredJid = async (
  wbot: WASocket,
  jid: string
): Promise<string> => {
  try {
    // If it's already a LID, return as is
    if (isLidUser(jid)) {
      return jid;
    }

    // If it's a PN, try to get the corresponding LID
    if (isPnUser(jid)) {
      const lid = await getLidForPN(wbot, jid);
      return lid || jid; // Return LID if available, otherwise original PN
    }

    return jid;
  } catch (error) {
    logger.error("Error getting preferred JID:", error);
    return jid;
  }
};

/**
 * Gets the phone number from any JID format (LID or PN)
 * @param wbot - WASocket instance
 * @param jid - JID in any format
 * @returns Promise<string>
 */
export const getPhoneNumberFromJid = async (
  wbot: WASocket,
  jid: string
): Promise<string> => {
  try {
    // If it's a PN, extract the number directly
    if (isPnUser(jid)) {
      return jid.replace(/\D/g, "");
    }

    // If it's a LID, get the corresponding PN
    if (isLidUser(jid)) {
      const pn = await getPNForLID(wbot, jid);
      if (pn) {
        return pn.replace(/\D/g, "");
      }
    }

    // Fallback: extract numbers from the JID
    return jid.replace(/\D/g, "");
  } catch (error) {
    logger.error("Error getting phone number from JID:", error);
    return jid.replace(/\D/g, "");
  }
};

/**
 * Gets the contact identifier (preferred format) from JID
 * @param wbot - WASocket instance
 * @param jid - JID in any format
 * @returns Promise<{contactId: string, lid?: string, phoneNumber?: string}>
 */
export const getContactIdentifiers = async (wbot: WASocket, jid: string) => {
  try {
    const cleanJid = jidNormalizedUser(jid).split("@")[0];

    if (isLidUser(jid)) {
      // If JID is LID, try to get corresponding PN
      const pn = await getPNForLID(wbot, jid);
      return {
        contactId: jid,
        lid: jid,
        phoneNumber: pn ? pn.replace(/\D/g, "") : undefined
      };
    } else if (isPnUser(jid)) {
      // If JID is PN, try to get corresponding LID
      const lid = await getLidForPN(wbot, jid);
      return {
        contactId: lid || jid, // Prefer LID if available
        lid: lid,
        phoneNumber: cleanJid.replace(/\D/g, "")
      };
    } else {
      // Fallback for other formats
      return {
        contactId: jid,
        phoneNumber: cleanJid.replace(/\D/g, "")
      };
    }
  } catch (error) {
    logger.error("Error getting contact identifiers:", error);
    return {
      contactId: jid
    };
  }
};
