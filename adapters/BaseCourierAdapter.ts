import { IOrder } from "../models/order.js";

export interface NormalizedCreateResult {
  courier_order_id?: string;
  awb: string;
  status: string;
  raw_request: any;
  raw_response: any;
}

export interface NormalizedTrackMilestone {
  status: string;
  courier_status_code?: string;
  courier_status_message?: string;
  timestamp: Date;
  raw_payload: any;
}

export interface NormalizedTrackResult {
  status: string;
  tracking_history: NormalizedTrackMilestone[];
  raw_response: any;
}

export interface NormalizedCancelResult {
  success: boolean;
  status: string;
  raw_request: any;
  raw_response: any;
}

export abstract class BaseCourierAdapter {
  public partnerName: string;

  constructor(partnerName: string) {
    this.partnerName = partnerName.toLowerCase();
  }

  /**
   * Create a single shipment / order
   * @param order - The normalized order database document
   */
  abstract createShipment(order: IOrder): Promise<NormalizedCreateResult>;

  /**
   * Track a shipment status
   * @param awb - Air Waybill number
   */
  abstract trackShipment(awb: string): Promise<NormalizedTrackResult>;

  /**
   * Cancel an order
   * @param awb - Air Waybill number
   */
  abstract cancelShipment(awb: string): Promise<NormalizedCancelResult>;
}

export default BaseCourierAdapter;
