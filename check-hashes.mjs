const bcrypt = require("./node_modules/.pnpm/bcryptjs@2.4.3/node_modules/bcryptjs");
const adminHash = "$2a$10$Zfmv.Mqy/XK1KzQnQTTFZeZV1UQHkexbVYRKhUcjQtuDBvxWW.LIa";
console.log("admin123 matches:", bcrypt.compareSync("admin123", adminHash));
console.log("wrong matches:", bcrypt.compareSync("wrong", adminHash));
