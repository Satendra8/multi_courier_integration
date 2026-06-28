# Multi-Courier Integration Platform

This project is a clean and simple Node.js, Express, and TypeScript API that connects multiple courier partners (like UrbaneBolt) under a single, unified system.

---

## What It Can Do
* **One API for All Couriers**: You get a single way to create, track, and cancel orders, no matter which courier partner is used behind the scenes.
* **Easy to Expand**: Adding a new courier partner takes just a few steps and doesn't require modifying any core code.
* **Bulk Uploads**: Handles up to 100 orders at once by processing them in the background, so you don't have to wait.
* **Automatic Retries & Logins**: Automatically retries if there's a quick network glitch, and logs back in if a session token expires.
* **Activity Log**: Keeps a record of errors and actions in the database, the console, and a `logs.txt` file.

---

## Tech Stack
* **Language**: Node.js & TypeScript
* **Server**: Express
* **Database**: MongoDB (via Mongoose)
* **HTTP Client**: Axios

---

## Setting Up

### 1. Environment Config
Configure your settings inside `data/config.env`:

```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/multi_courier_db
FRONTEND_URL=http://localhost:5173

# UrbaneBolt UAT Credentials
URBANEBOLT_BASE_URL=https://uat.urbanebolt.in
URBANEBOLT_USERNAME=info@urbanebolt.com
URBANEBOLT_PASSWORD=EKIcygsLVV5RCtPZ

# Retry Configuration
HTTP_TIMEOUT_MS=10000
RETRY_COUNT=3
RETRY_BACKOFF_FACTOR=2

# Use Simulated/Mocked Courier Mode
MOCK_URBANEBOLT=true
```

> [!NOTE]
> Setting `MOCK_URBANEBOLT=true` lets you test everything locally without relying on the live UrbaneBolt UAT API (which can sometimes be offline).

### 2. Run the App
1. **Install everything**:
   ```bash
   npm install
   ```
2. **Start MongoDB**: Make sure MongoDB is running on port 27017.
3. **Start the server**:
   * **For Development** (runs TS code directly with hot-reload):
     ```bash
     npm run dev
     ```
   * **For Production** (builds and runs compiled JS):
     ```bash
     npm run build
     npm start
     ```

---

## Testing

You can do testing using Postman collection in `postman_collection.json` to import into Postman.

---

## How to Add a New Courier Partner

Adding a new courier (for example, `Delhivery`) is very easy:

1. **Create the Adapter**:
   Create a new file `adapters/DelhiveryAdapter.ts` that extends `BaseCourierAdapter` and implements three functions:
   ```typescript
   import { IOrder } from "../models/order.js";
   import BaseCourierAdapter, {
     NormalizedCreateResult,
     NormalizedTrackResult,
     NormalizedCancelResult
   } from "./BaseCourierAdapter.js";

   export class DelhiveryAdapter extends BaseCourierAdapter {
     constructor() {
       super("delhivery");
     }

     async createShipment(order: IOrder): Promise<NormalizedCreateResult> {
       // Map our order fields to Delhivery's API format and call their API
     }

     async trackShipment(awb: string): Promise<NormalizedTrackResult> {
       // Fetch and normalize tracking milestones
     }

     async cancelShipment(awb: string): Promise<NormalizedCancelResult> {
       // Tell Delhivery to cancel the shipment
     }
   }
   ```

2. **Register it in the Factory**:
   Open `adapters/CourierFactory.ts` and add it to the list:
   ```typescript
   import DelhiveryAdapter from "./DelhiveryAdapter.js";

   export class CourierFactory {
     static registry = {
       urbanebolt: UrbaneBoltAdapter,
       mockcourier: MockCourierAdapter,
       delhivery: DelhiveryAdapter, // <-- Add here
     };
   }
   ```

That is it! You do not need to touch any routes, controllers, or database code.
