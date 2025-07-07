import path from "path";
import multer from "multer";
import fs from "fs";
import { randomBytes } from "crypto";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      const { typeArch, fileId } = req.body;

      let folder;

      if (typeArch && typeArch !== "announcements") {
        folder = path.resolve(publicFolder, typeArch, fileId ? fileId : "");
      } else if (typeArch && typeArch === "announcements") {
        folder = path.resolve(publicFolder, typeArch);
      } else {
        folder = path.resolve(publicFolder);
      }

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }
      return cb(null, folder);
    },
    filename(_, file, cb) {
      const ext = path.extname(file.originalname);
      const baseName = path
        .basename(file.originalname, ext)
        .replace("/", "-")
        .replace(/ /g, "_");

      const uniqueSuffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
      const fileName = `${baseName}-${uniqueSuffix}${ext}`;

      return cb(null, fileName);
    }
  })
};
