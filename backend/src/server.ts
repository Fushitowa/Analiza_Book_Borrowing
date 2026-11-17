import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_FILE || "../.env" });

import app from "./app.js";

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Ana's Book Browse API is listening on port ${port}`);
});
