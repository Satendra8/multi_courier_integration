import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";

export class ErrorHandler extends Error {
  public statusCode: number;
  public code: string;
  public details: any;

  constructor(message: string, statusCode: number, code: string = "INTERNAL_SERVER_ERROR", details: any = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ErrorHandler.prototype);
  }
}

export const errMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const message = err.message || "Internal Server Error";
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";
  const details = err.details || null;

  // Console output
  console.error(
    `[Error] Code: ${code} | Status: ${statusCode} | Msg: ${message}${details ? ` | Details: ${JSON.stringify(details)}` : ""}`
  );

  // save logs to logs.txt
  const logMessage = `[${new Date().toISOString()}] Error: Code: ${code} | Status: ${statusCode} | Msg: ${message}${details ? ` | Details: ${JSON.stringify(details)}` : ""}\n`;
  try {
    fs.appendFileSync(path.resolve("logs.txt"), logMessage);
  } catch (fileErr: any) {
    console.error("Failed to write to logs.txt", fileErr.message);
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      details,
    },
  });
};

export default ErrorHandler;
