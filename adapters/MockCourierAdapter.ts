import { IOrder } from "../models/order.js";
import BaseCourierAdapter, {
  NormalizedCreateResult,
  NormalizedTrackResult,
  NormalizedCancelResult,
  NormalizedTrackMilestone,
} from "./BaseCourierAdapter.js";

export class MockCourierAdapter extends BaseCourierAdapter {
  constructor() {
    super("mockcourier");
  }

  /**
   * Simulate creation of shipment / order for MockCourier
   */
  async createShipment(order: IOrder): Promise<NormalizedCreateResult> {
    console.log(`[MockCourier] Processing shipment for internal order: ${order.order_id}`);
    
    // Simulate a brief response latency
    await new Promise((resolve) => setTimeout(resolve, 300));

    const mockAwb = `MC${Math.floor(100000000 + Math.random() * 900000000)}`;
    const mockCourierOrderId = `MCO-${Math.floor(100000 + Math.random() * 900000)}`;

    const mockResponse = {
      success: true,
      partner: "MockCourier",
      courier_reference: mockCourierOrderId,
      airway_bill: mockAwb,
      estimated_delivery: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days later
      service_tier: order.shipment_details.service_type || "STANDARD",
      weight_charged_kg: order.shipment_details.weight || 0.5,
    };

    return {
      courier_order_id: mockCourierOrderId,
      awb: mockAwb,
      status: "CREATED",
      raw_request: { order_id: order.order_id, partner: "mockcourier", weight: order.shipment_details.weight },
      raw_response: mockResponse,
    };
  }

  /**
   * Simulate tracking for MockCourier
   */
  async trackShipment(awb: string): Promise<NormalizedTrackResult> {
    console.log(`[MockCourier] Fetching tracking status for AWB: ${awb}`);

    await new Promise((resolve) => setTimeout(resolve, 150));

    // Simulate tracking history based on random outcomes
    const mockResponse = {
      tracking_number: awb,
      carrier: "MockCourier",
      current_stage: "IN_TRANSIT",
      milestones: [
        { status: "MANIFESTED", location: "Mumbai sorting facility", event_time: new Date(Date.now() - 3600000 * 3).toISOString(), details: "Data received" },
        { status: "IN_TRANSIT", location: "Surat warehouse", event_time: new Date().toISOString(), details: "Package sorted and dispatched" },
      ],
    };

    const normalizedHistory: NormalizedTrackMilestone[] = mockResponse.milestones.map((milestone) => ({
      status: milestone.status === "MANIFESTED" ? "CREATED" : "IN_TRANSIT",
      courier_status_code: milestone.status,
      courier_status_message: milestone.details,
      timestamp: new Date(milestone.event_time),
      raw_payload: milestone,
    }));

    return {
      status: "IN_TRANSIT",
      tracking_history: normalizedHistory,
      raw_response: mockResponse,
    };
  }

  /**
   * Simulate cancellation for MockCourier
   */
  async cancelShipment(awb: string): Promise<NormalizedCancelResult> {
    console.log(`[MockCourier] Requesting cancellation for AWB: ${awb}`);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const mockResponse = {
      status: "VOIDED",
      awb_cancelled: awb,
      processed_at: new Date().toISOString(),
      cancellation_charge: 0.00,
    };

    return {
      success: true,
      status: "CANCELLED",
      raw_request: { action: "CANCEL", awb: awb },
      raw_response: mockResponse,
    };
  }
}

export default MockCourierAdapter;
