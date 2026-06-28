import ErrorHandler from "../middlewares/error.js";

export interface CustomerDetails {
  receiver_name: string;
  receiver_mobile: string;
  receiver_email?: string;
  receiver_address: string;
  receiver_city: string;
  receiver_state: string;
  receiver_pincode: number | string;
  sender_name?: string;
  sender_mobile?: string;
  sender_email?: string;
  sender_address?: string;
  sender_city?: string;
  sender_state?: string;
  sender_pincode?: number | string;
}

export interface ShipmentDetails {
  declared_value: number;
  collectable_value?: number;
  pay_mode?: string;
  weight: number;
  item_description?: string;
  item_quantity?: number;
  height?: number;
  length?: number;
  width?: number;
  breadth?: number;
  service_type?: string;
}

export interface OrderPayload {
  order_id: string;
  courier_partner: string;
  customer_details: CustomerDetails;
  shipment_details: ShipmentDetails;
}

/**
 * Helper to validate order payload
 * @param {any} payload - Incoming request body payload
 */
export const validateOrderPayload = (payload: any): void => {
  if (!payload || typeof payload !== "object") {
    throw new ErrorHandler("Invalid request payload", 400, "VALIDATION_ERROR");
  }

  const requiredFields = ["order_id", "courier_partner", "customer_details", "shipment_details"];
  const missing: string[] = [];

  for (const field of requiredFields) {
    if (!payload[field]) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ErrorHandler(
      `Missing required top-level fields: ${missing.join(", ")}`,
      400,
      "VALIDATION_ERROR"
    );
  }

  // Validate Customer Details
  const customerFields = [
    "receiver_name",
    "receiver_mobile",
    "receiver_address",
    "receiver_city",
    "receiver_state",
    "receiver_pincode",
  ];
  const missingCustomer: string[] = [];
  const cust = payload.customer_details;

  if (!cust || typeof cust !== "object") {
    throw new ErrorHandler("customer_details must be an object", 400, "VALIDATION_ERROR");
  }

  for (const field of customerFields) {
    if (!cust[field]) {
      missingCustomer.push(field);
    }
  }

  if (missingCustomer.length > 0) {
    throw new ErrorHandler(
      `Missing receiver details: ${missingCustomer.join(", ")}`,
      400,
      "VALIDATION_ERROR"
    );
  }

  // Validate Shipment Details
  const shipmentFields = ["declared_value", "weight"];
  const missingShipment: string[] = [];
  const ship = payload.shipment_details;

  if (!ship || typeof ship !== "object") {
    throw new ErrorHandler("shipment_details must be an object", 400, "VALIDATION_ERROR");
  }

  for (const field of shipmentFields) {
    if (ship[field] === undefined || ship[field] === null) {
      missingShipment.push(field);
    }
  }

  if (missingShipment.length > 0) {
    throw new ErrorHandler(
      `Missing shipment details: ${missingShipment.join(", ")}`,
      400,
      "VALIDATION_ERROR"
    );
  }
};

export default validateOrderPayload;
