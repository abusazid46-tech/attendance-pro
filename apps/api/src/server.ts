import { createApp } from "./app.js";
import { env } from "./config/env.js";

createApp().listen(env.API_PORT, () => {
  console.log(`Attendance API listening on http://localhost:${env.API_PORT}`);
});
