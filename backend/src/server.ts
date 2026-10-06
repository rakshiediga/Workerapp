import "dotenv/config";
import app from "./app.js";

const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = app.listen(port, () => {
  console.log(`Worker Booking API is running at http://localhost:${port}`);
});

server.on("error", (error) => {
  console.error("Unable to start Worker Booking API:", error.message);
  process.exitCode = 1;
});
