import { app } from "./app.js";
import { connectDB } from "./data/database.js";

// Initialize Database Connection
connectDB();

const port: string | number = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running at port ${port} in ${process.env.NODE_ENV} mode.`);
});
