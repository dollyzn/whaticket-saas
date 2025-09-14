import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Contacts", "contactId", {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Preferred WhatsApp ID (LID or PN) - Baileys 7.x.x"
      }),

      queryInterface.addColumn("Contacts", "lid", {
        type: DataTypes.STRING,
        allowNull: true,
        comment:
          "WhatsApp LID (Local Identifier) - present when contactId is a PN"
      }),

      queryInterface.addColumn("Contacts", "phoneNumber", {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Phone number - present when contactId is a LID"
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Contacts", "contactId"),
      queryInterface.removeColumn("Contacts", "lid"),
      queryInterface.removeColumn("Contacts", "phoneNumber")
    ]);
  }
};
