import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

import supersetRoutes from "./routes/supersetRoutes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 5000;

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error(`CORS blocked origin: ${origin}`);
      error.statusCode = 403;
      error.expose = true;

      return callback(error);
    },
  }),
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", supersetRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, _req, res, _next) => {
  console.error({
    message: err.message,
    statusCode: err.statusCode || 500,
  });

  res.status(err.statusCode || 500).json({
    message:
      process.env.NODE_ENV === "production" && !err.expose
        ? "Internal server error"
        : err.message,
  });
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
