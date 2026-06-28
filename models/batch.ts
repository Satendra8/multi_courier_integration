import mongoose, { Document, Schema, Model } from "mongoose";

export interface IBatchResult {
  order_id: string;
  success: boolean;
  awb?: string | null;
  courier_partner?: string;
  error_message?: string | null;
}

export interface IBatch extends Document {
  batch_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED";
  total_orders: number;
  processed_orders: number;
  success_count: number;
  failure_count: number;
  results: IBatchResult[];
  createdAt: Date;
  updatedAt: Date;
}

const batchSchema: Schema<IBatch> = new Schema(
  {
    batch_id: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "PROCESSING", "COMPLETED"],
      default: "PENDING",
    },
    total_orders: { type: Number, required: true },
    processed_orders: { type: Number, default: 0 },
    success_count: { type: Number, default: 0 },
    failure_count: { type: Number, default: 0 },
    results: [
      {
        order_id: { type: String, required: true },
        success: { type: Boolean, required: true },
        awb: { type: String },
        courier_partner: { type: String },
        error_message: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export const Batch: Model<IBatch> = mongoose.model<IBatch>("Batch", batchSchema);
export default Batch;
