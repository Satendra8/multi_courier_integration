import mongoose, { Document, Schema, Model } from "mongoose";
import { CustomerDetails, ShipmentDetails } from "../utils/validation.js";

export interface IOrder extends Document {
  order_id: string;
  courier_partner: string;
  courier_order_id?: string;
  awb?: string;
  status: "CREATED" | "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "FAILED";
  customer_details: CustomerDetails;
  shipment_details: ShipmentDetails;
  raw_request?: any;
  raw_response?: any;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema: Schema<IOrder> = new Schema(
  {
    order_id: { type: String, required: true, unique: true, index: true },
    courier_partner: { type: String, required: true },
    courier_order_id: { type: String },
    awb: { type: String, index: true },
    status: {
      type: String,
      required: true,
      enum: ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "FAILED"],
      default: "CREATED",
    },
    customer_details: {
      sender_name: String,
      sender_mobile: String,
      sender_email: String,
      sender_address: String,
      sender_city: String,
      sender_state: String,
      sender_pincode: Schema.Types.Mixed,
      receiver_name: { type: String, required: true },
      receiver_mobile: { type: String, required: true },
      receiver_email: String,
      receiver_address: { type: String, required: true },
      receiver_city: { type: String, required: true },
      receiver_state: { type: String, required: true },
      receiver_pincode: { type: Schema.Types.Mixed, required: true },
    },
    shipment_details: {
      declared_value: { type: Number, required: true },
      collectable_value: { type: Number, default: 0 },
      pay_mode: { type: String, enum: ["COD", "PREPAID"], default: "PREPAID" },
      weight: { type: Number, required: true },
      item_description: String,
      item_quantity: { type: Number, default: 1 },
      height: { type: Number, default: 10 },
      length: { type: Number, default: 10 },
      width: { type: Number, default: 10 },
      service_type: { type: String, enum: ["SDD", "NDD", "STANDARD"], default: "STANDARD" },
    },
    raw_request: { type: Schema.Types.Mixed },
    raw_response: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Order: Model<IOrder> = mongoose.model<IOrder>("Order", orderSchema);
export default Order;
