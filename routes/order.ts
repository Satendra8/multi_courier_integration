import express, { Router } from "express";
import {
  createOrder,
  trackOrder,
  cancelOrder,
  bulkCreateOrders,
  getBatchStatus,
} from "../controllers/order.js";

const router: Router = express.Router();

router.post("/orders", createOrder);
router.get("/orders/:order_id/track", trackOrder);
router.post("/orders/:order_id/cancel", cancelOrder);

router.post("/orders/bulk", bulkCreateOrders);

router.get("/batches/:batch_id", getBatchStatus);

export default router;
