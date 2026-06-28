import express, { Express, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "dotenv";
import orderRouter from "./routes/order.js";
import { errMiddleware } from "./middlewares/error.js";

config({
  path: "./data/config.env",
});

export const app: Express = express();

// Request logging middleware
const logRequest = (req: Request, res: Response, next: NextFunction): void => {
  console.log(`[API Calling] ${req.method} ${req.url} - Body:`, JSON.stringify(req.body));
  next();
};


app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  })
);

app.use(logRequest);


app.use("/api/v1", orderRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Multi-Courier Integration Platform API is running.");
});

app.use(errMiddleware);

export default app;
