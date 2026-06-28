import mongoose, { Document, Schema, Model } from "mongoose";

export interface ITrackingHistory extends Document {
  order_id: string;
  awb: string;
  status: string;
  courier_status_code?: string;
  courier_status_message?: string;
  timestamp: Date;
  raw_payload?: any;
  createdAt: Date;
  updatedAt: Date;
}

const trackingHistorySchema: Schema<ITrackingHistory> = new Schema(
  {
    order_id: { type: String, required: true, index: true },
    awb: { type: String, required: true, index: true },
    status: { type: String, required: true },
    courier_status_code: { type: String },
    courier_status_message: { type: String },
    timestamp: { type: Date, default: Date.now, required: true },
    raw_payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Enforce append-only updates/deletes restriction
const blockModification = function (this: any, next: (err?: Error) => void) {
  const error = new Error("Tracking history records are immutable and append-only.");
  next(error);
};

trackingHistorySchema.pre("updateOne", blockModification);
trackingHistorySchema.pre("updateMany", blockModification);
trackingHistorySchema.pre("findOneAndUpdate", blockModification);
trackingHistorySchema.pre("deleteOne", blockModification);
trackingHistorySchema.pre("deleteMany", blockModification);
trackingHistorySchema.pre("findOneAndDelete", blockModification);

export const TrackingHistory: Model<ITrackingHistory> = mongoose.model<ITrackingHistory>(
  "TrackingHistory",
  trackingHistorySchema
);
export default TrackingHistory;
