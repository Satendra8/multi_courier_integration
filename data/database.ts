import mongoose from "mongoose";

export const connectDB = (): void => {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/multi_courier_db";
  
  mongoose
    .connect(mongoUri, {
      dbName: "multi_courier_db",
    })
    .then((c) => console.log(`[Database] Connected successfully to host: ${c.connection.host}`))
    .catch((e: any) => {
      console.error("[Database] Connection failed:", e.message);
      process.exit(1);
    });
};
