import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";
import tokenAuth from "../middleware/tokenAuth";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

messageRoutes.get("/messages/:ticketId", isAuth, MessageController.index);
messageRoutes.post(
  "/messages/:ticketId",
  isAuth,
  upload.array("medias") as any,
  MessageController.store
);
messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);
messageRoutes.post(
  "/api/messages/send/:whatsappId?",
  tokenAuth,
  upload.array("medias") as any,
  MessageController.send
);

export default messageRoutes;
