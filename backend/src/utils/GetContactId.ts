import Contact from "../models/Contact";

export default function getContactId(
  contact: Contact,
  isGroup?: boolean
): string {
  if (contact.contactId) return contact.contactId;
  return `${contact.number}@${
    isGroup ?? contact.isGroup ? "g.us" : "s.whatsapp.net"
  }`;
}
