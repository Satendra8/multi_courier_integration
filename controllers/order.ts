import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { Order } from "../models/order.js";
import { TrackingHistory } from "../models/trackingHistory.js";
import { Batch } from "../models/batch.js";
import { CourierFactory } from "../adapters/CourierFactory.js";
import { ErrorHandler } from "../middlewares/error.js";
import { validateOrderPayload, OrderPayload } from "../utils/validation.js";

/**
 * 1. Create Shipment (Single Order)
 * POST /api/v1/orders
 */
export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const payload = req.body;

    // Validate Input Payload
    validateOrderPayload(payload);

    const { order_id, courier_partner } = payload as OrderPayload;

    // Idempotency check
    const existingOrder = await Order.findOne({ order_id });
    if (existingOrder) {
      console.log(`[Order API] Idempotency triggered. Order ${order_id} already exists.`);
      return res.status(200).json({
        success: true,
        message: "Order already exists (Idempotent response)",
        order: existingOrder,
      });
    }

    const adapter = CourierFactory.getAdapter(courier_partner);

    const newOrder = new Order({
      order_id,
      courier_partner,
      customer_details: payload.customer_details,
      shipment_details: payload.shipment_details,
      status: "CREATED",
    });

    await newOrder.save();

    let shipmentResult;
    try {
      shipmentResult = await adapter.createShipment(newOrder);
    } catch (courierErr: any) {
      newOrder.status = "FAILED";
      newOrder.raw_request = courierErr.details || null;
      newOrder.raw_response = { error: courierErr.message };
      await newOrder.save();

      throw courierErr;
    }

    // Update order with courier results
    newOrder.status = shipmentResult.status as any;
    newOrder.courier_order_id = shipmentResult.courier_order_id;
    newOrder.awb = shipmentResult.awb;
    newOrder.raw_request = shipmentResult.raw_request;
    newOrder.raw_response = shipmentResult.raw_response;
    await newOrder.save();

    // Create initial Tracking History record
    const initHistory = new TrackingHistory({
      order_id: newOrder.order_id,
      awb: newOrder.awb,
      status: newOrder.status,
      courier_status_code: "CREATED",
      courier_status_message: "Shipment registered/created with courier partner",
      raw_payload: shipmentResult.raw_response,
    });
    await initHistory.save();

    res.status(201).json({
      success: true,
      message: "Shipment created successfully",
      order: newOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Track Shipment
 * GET /api/v1/orders/:order_id/track
 */
export const trackOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { order_id } = req.params;

    const order = await Order.findOne({ order_id });
    if (!order) {
      return next(new ErrorHandler(`Order with ID ${order_id} not found`, 404, "ORDER_NOT_FOUND"));
    }

    if (!order.awb) {
      return res.status(200).json({
        success: true,
        order_id: order.order_id,
        status: order.status,
        courier_partner: order.courier_partner,
        message: "No tracking details (AWB) generated for this shipment yet.",
        tracking_history: [],
      });
    }

    try {
      const adapter = CourierFactory.getAdapter(order.courier_partner);
      const trackingData = await adapter.trackShipment(order.awb);

      const oldStatus = order.status;
      const newStatus = trackingData.status;

      if (oldStatus !== newStatus) {
        order.status = newStatus as any;
        await order.save();
      }

      const existingHistory = await TrackingHistory.find({ order_id });
      const existingStatuses = new Set(existingHistory.map((h) => `${h.status}-${new Date(h.timestamp).getTime()}`));

      for (const milestone of trackingData.tracking_history) {
        const key = `${milestone.status}-${new Date(milestone.timestamp).getTime()}`;
        if (!existingStatuses.has(key)) {
          const historyEntry = new TrackingHistory({
            order_id: order.order_id,
            awb: order.awb,
            status: milestone.status,
            courier_status_code: milestone.courier_status_code,
            courier_status_message: milestone.courier_status_message,
            timestamp: milestone.timestamp,
            raw_payload: milestone.raw_payload,
          });
          await historyEntry.save();
        }
      }
    } catch (trackErr: any) {
      console.error(`[Tracking Error] Failed to fetch live tracking for order ${order_id}:`, trackErr.message);
    }

    const history = await TrackingHistory.find({ order_id }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      order_id: order.order_id,
      awb: order.awb,
      courier_partner: order.courier_partner,
      status: order.status,
      tracking_history: history.map((h) => ({
        status: h.status,
        remarks: h.courier_status_message,
        timestamp: h.timestamp,
        raw_payload: h.raw_payload,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Cancel Shipment
 * POST /api/v1/orders/:order_id/cancel
 */
export const cancelOrder = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { order_id } = req.params;

    const order = await Order.findOne({ order_id });
    if (!order) {
      return next(new ErrorHandler(`Order with ID ${order_id} not found`, 404, "ORDER_NOT_FOUND"));
    }

    if (order.status === "CANCELLED") {
      return res.status(200).json({
        success: true,
        message: "Order is already cancelled (Idempotent response)",
        order,
      });
    }

    if (order.status === "DELIVERED") {
      return next(new ErrorHandler("Cannot cancel a delivered shipment", 400, "INVALID_STATE"));
    }

    if (!order.awb) {
      order.status = "CANCELLED";
      await order.save();

      const cancelHistory = new TrackingHistory({
        order_id: order.order_id,
        awb: "N/A",
        status: "CANCELLED",
        courier_status_code: "CANCELLED",
        courier_status_message: "Shipment cancelled by consumer before courier allocation",
        raw_payload: { reason: "User cancelled" },
      });
      await cancelHistory.save();

      return res.status(200).json({
        success: true,
        message: "Order cancelled successfully (local cancellation)",
        order,
      });
    }

    const adapter = CourierFactory.getAdapter(order.courier_partner);
    const cancelResult = await adapter.cancelShipment(order.awb);

    if (cancelResult.success) {
      order.status = "CANCELLED";
      await order.save();

      const cancelHistory = new TrackingHistory({
        order_id: order.order_id,
        awb: order.awb,
        status: "CANCELLED",
        courier_status_code: "CANCELLED",
        courier_status_message: "Shipment cancelled successfully with courier partner",
        raw_payload: cancelResult.raw_response,
      });
      await cancelHistory.save();

      return res.status(200).json({
        success: true,
        message: "Order cancelled successfully with courier partner",
        order,
      });
    } else {
      throw new ErrorHandler(
        "Courier partner declined cancellation",
        400,
        "COURIER_CANCELLATION_DECLINED",
        cancelResult.raw_response
      );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Background worker logic
 */
const processBulkBackground = async (batchId: string, orders: any[]): Promise<void> => {
  console.log(`[Bulk Worker] Starting background processing for batch: ${batchId}`);

  const batch = await Batch.findOne({ batch_id: batchId });
  if (!batch) return;

  batch.status = "PROCESSING";
  await batch.save();

  const promises = orders.map(async (orderData) => {
    const { order_id, courier_partner } = orderData;
    let orderSuccess = false;
    let awb: string | null | undefined = null;
    let errMsg: string | null = null;

    try {
      validateOrderPayload(orderData);

      let orderDoc = await Order.findOne({ order_id });

      if (orderDoc) {
        if (orderDoc.status !== "FAILED") {
          orderSuccess = true;
          awb = orderDoc.awb;
        } else {
          const adapter = CourierFactory.getAdapter(courier_partner);
          orderDoc.status = "CREATED";
          await orderDoc.save();

          const shipmentResult = await adapter.createShipment(orderDoc);
          orderDoc.status = shipmentResult.status as any;
          orderDoc.courier_order_id = shipmentResult.courier_order_id;
          orderDoc.awb = shipmentResult.awb;
          orderDoc.raw_request = shipmentResult.raw_request;
          orderDoc.raw_response = shipmentResult.raw_response;
          await orderDoc.save();

          const initHistory = new TrackingHistory({
            order_id: orderDoc.order_id,
            awb: orderDoc.awb,
            status: orderDoc.status,
            courier_status_code: "CREATED",
            courier_status_message: "Shipment re-registered/created with courier partner",
            raw_payload: shipmentResult.raw_response,
          });
          await initHistory.save();

          orderSuccess = true;
          awb = orderDoc.awb;
        }
      } else {
        orderDoc = new Order({
          order_id,
          courier_partner,
          customer_details: orderData.customer_details,
          shipment_details: orderData.shipment_details,
          status: "CREATED",
        });
        await orderDoc.save();

        const adapter = CourierFactory.getAdapter(courier_partner);
        const shipmentResult = await adapter.createShipment(orderDoc);

        orderDoc.status = shipmentResult.status as any;
        orderDoc.courier_order_id = shipmentResult.courier_order_id;
        orderDoc.awb = shipmentResult.awb;
        orderDoc.raw_request = shipmentResult.raw_request;
        orderDoc.raw_response = shipmentResult.raw_response;
        await orderDoc.save();

        const initHistory = new TrackingHistory({
          order_id: orderDoc.order_id,
          awb: orderDoc.awb,
          status: orderDoc.status,
          courier_status_code: "CREATED",
          courier_status_message: "Shipment registered/created with courier partner",
          raw_payload: shipmentResult.raw_response,
        });
        await initHistory.save();

        orderSuccess = true;
        awb = orderDoc.awb;
      }
    } catch (err: any) {
      errMsg = err.message || "Failed to process order";
      console.error(`[Bulk Worker] Order ${order_id} failed:`, errMsg);

      try {
        const orderDoc = await Order.findOne({ order_id });
        if (orderDoc) {
          orderDoc.status = "FAILED";
          orderDoc.raw_response = { error: errMsg, details: err.details || null };
          await orderDoc.save();
        }
      } catch (dbErr: any) {
        console.error(`[Bulk Worker] Failed to update order status for ${order_id}:`, dbErr.message);
      }
    }

    await Batch.findOneAndUpdate(
      { batch_id: batchId },
      {
        $inc: {
          processed_orders: 1,
          success_count: orderSuccess ? 1 : 0,
          failure_count: orderSuccess ? 0 : 1,
        },
        $push: {
          results: {
            order_id,
            success: orderSuccess,
            awb: awb || null,
            courier_partner,
            error_message: errMsg || null,
          },
        },
      }
    );
  });

  await Promise.allSettled(promises);

  await Batch.findOneAndUpdate(
    { batch_id: batchId },
    { status: "COMPLETED" }
  );

  console.log(`[Bulk Worker] Completed background processing for batch: ${batchId}`);
};

/**
 * 4. Bulk Create Shipments (Up to 100 orders)
 * POST /api/v1/orders/bulk
 */
export const bulkCreateOrders = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return next(new ErrorHandler("Request body must contain an 'orders' array", 400, "VALIDATION_ERROR"));
    }

    if (orders.length === 0) {
      return next(new ErrorHandler("Orders array cannot be empty", 400, "VALIDATION_ERROR"));
    }

    if (orders.length > 100) {
      return next(new ErrorHandler("Bulk creation is capped at a maximum of 100 orders per request", 400, "VALIDATION_ERROR"));
    }

    const batchId = `BATCH-${crypto.randomUUID()}`;

    const newBatch = new Batch({
      batch_id: batchId,
      status: "PENDING",
      total_orders: orders.length,
      processed_orders: 0,
      success_count: 0,
      failure_count: 0,
      results: [],
    });
    await newBatch.save();

    processBulkBackground(batchId, orders).catch((err) => {
      console.error(`[Bulk Process Critical Error] Batch ${batchId} failed:`, err);
    });

    res.status(202).json({
      success: true,
      batch_id: batchId,
      status: "PENDING",
      total_orders: orders.length,
      message: "Bulk order processing initialized in the background. Please poll the status endpoint to monitor progress.",
      status_url: `/api/v1/batches/${batchId}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Get Batch Status / Progress
 * GET /api/v1/batches/:batch_id
 */
export const getBatchStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { batch_id } = req.params;

    const batch = await Batch.findOne({ batch_id });
    if (!batch) {
      return next(new ErrorHandler(`Batch with ID ${batch_id} not found`, 404, "BATCH_NOT_FOUND"));
    }

    res.status(200).json({
      success: true,
      batch_id: batch.batch_id,
      status: batch.status,
      progress: {
        total: batch.total_orders,
        processed: batch.processed_orders,
        success: batch.success_count,
        failed: batch.failure_count,
        pct_complete: Math.round((batch.processed_orders / batch.total_orders) * 100),
      },
      results: batch.results,
    });
  } catch (error) {
    next(error);
  }
};
