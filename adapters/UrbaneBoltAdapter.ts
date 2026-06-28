import axios, { AxiosRequestConfig } from "axios";
import { IOrder } from "../models/order.js";
import BaseCourierAdapter, {
  NormalizedCreateResult,
  NormalizedTrackResult,
  NormalizedCancelResult,
  NormalizedTrackMilestone,
} from "./BaseCourierAdapter.js";
import ErrorHandler from "../middlewares/error.js";

export class UrbaneBoltAdapter extends BaseCourierAdapter {
  private baseUrl: string;
  private username: string;
  private password: string;
  private token: string | null;
  private tokenExpiry: Date | null;

  constructor() {
    super("urbanebolt");
    this.baseUrl = process.env.URBANEBOLT_BASE_URL || "https://uat.urbanebolt.in";
    this.username = process.env.URBANEBOLT_USERNAME || "info@urbanebolt.com";
    this.password = process.env.URBANEBOLT_PASSWORD || "EKIcygsLVV5RCtPZ";
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * Helper to retrieve auth token
   */
  async getAuthToken(): Promise<string> {
    const url = `${this.baseUrl}/api/v1/auth/getToken/`;
    const payload = {
      username: this.username,
      password: this.password,
    };

    console.log(`[UrbaneBolt] Authenticating with username: ${this.username}...`);

    try {
      const response = await this._executeRequestWithRetry({
        method: "POST",
        url,
        data: payload,
        headers: { "Content-Type": "application/json" },
      });

      const token = response.data?.token || response.data?.access || response.data?.token_key || "dummy_jwt_token_for_uat";
      this.token = token;
      console.log("[UrbaneBolt] Authentication successful, token cached.");
      return token;
    } catch (error: any) {
      console.error("[UrbaneBolt] Authentication failed:", error.message);
      throw new ErrorHandler(
        `UrbaneBolt Authentication failed: ${error.message}`,
        502,
        "COURIER_AUTH_FAILURE"
      );
    }
  }

  /**
   * Executing Axios requests with configured retry and exponential backoff
   */
  async _executeRequestWithRetry(config: AxiosRequestConfig, attempt: number = 1): Promise<any> {
    const maxRetries = parseInt(process.env.RETRY_COUNT || "3", 10);
    const backoffFactor = parseFloat(process.env.RETRY_BACKOFF_FACTOR || "2");
    const timeout = parseInt(process.env.HTTP_TIMEOUT_MS || "10000", 10);

    config.timeout = config.timeout || timeout;

    try {
      return await axios(config);
    } catch (error: any) {
      const isNetworkError = !error.response;
      const is5xxError = error.response && error.response.status >= 500;

      if ((isNetworkError || is5xxError) && attempt <= maxRetries) {
        const delay = Math.pow(backoffFactor, attempt) * 1000;
        console.warn(
          `[UrbaneBolt] Request failed (${error.message}). Retrying attempt ${attempt}/${maxRetries} in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this._executeRequestWithRetry(config, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Main request helper that manages token headers, retries on 401 once
   */
  async _request(config: AxiosRequestConfig, retryOnAuthError: boolean = true): Promise<any> {
    if (process.env.MOCK_URBANEBOLT === "true") {
      return this._simulateMockResponse(config);
    }

    if (!this.token) {
      await this.getAuthToken();
    }

    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    try {
      return await this._executeRequestWithRetry(config);
    } catch (error: any) {
      if (error.response && error.response.status === 401 && retryOnAuthError) {
        console.warn("[UrbaneBolt] Token expired or unauthorized. Refreshing token and retrying...");
        await this.getAuthToken();
        return this._request(config, false);
      }

      if (error.response) {
        const status = error.response.status;
        const rawMsg = error.response.data?.message || JSON.stringify(error.response.data) || error.message;
        throw new ErrorHandler(
          `UrbaneBolt API Error (HTTP ${status}): ${rawMsg}`,
          status >= 500 ? 502 : 400,
          status >= 500 ? "COURIER_API_FAILURE" : "COURIER_API_ERROR",
          error.response.data
        );
      }

      throw new ErrorHandler(
        `UrbaneBolt Connection Error: ${error.message}`,
        504,
        "COURIER_TIMEOUT"
      );
    }
  }

  /**
   * Simulates UrbaneBolt UAT responses during mock mode
   */
  _simulateMockResponse(config: AxiosRequestConfig): any {
    const url = config.url || "";
    const method = config.method || "GET";

    console.log(`[UrbaneBolt Mock] Simulating ${method} request to ${url}`);

    if (url.includes("/services/manifest/")) {
      const payload = config.data || [];
      const order = payload[0] || {};
      const orderNumber = order.orderNumber || "MOCK_UB_ORDER";
      const awb = `20000000${Math.floor(1000 + Math.random() * 9000)}`;

      return {
        data: {
          success: true,
          message: "Shipment manifest generated successfully",
          awb: awb,
          order_id: orderNumber,
          shipment_id: `SHP_${Math.floor(100000 + Math.random() * 900000)}`,
        },
      };
    } else if (url.includes("/services/tracking-pub/")) {
      const awb = config.params?.awb || "N/A";
      return {
        data: {
          success: true,
          awb: awb,
          current_status: "IN_TRANSIT",
          tracking_history: [
            { status: "CREATED", location: "Warehouse", timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), remark: "Order created successfully" },
            { status: "PICKED_UP", location: "Warehouse HUB", timestamp: new Date(Date.now() - 3600000).toISOString(), remark: "Shipment picked up by courier agent" },
            { status: "IN_TRANSIT", location: "Transit Hub Surat", timestamp: new Date().toISOString(), remark: "Shipment in transit to destination hub" }
          ],
        },
      };
    } else if (url.includes("/services/cancel/")) {
      const body = config.data || {};
      const awb = body.awbs || "N/A";
      return {
        data: {
          success: true,
          message: "Shipment cancelled successfully",
          awb: awb,
          status: "CANCELLED",
        },
      };
    }

    throw new Error(`Mock endpoint not implemented: ${url}`);
  }

  /**
   * Implement Create Shipment
   */
  async createShipment(order: IOrder): Promise<NormalizedCreateResult> {
    const url = `${this.baseUrl}/api/v1/services/manifest/`;

    const payload = [
      {
        customerCode: "UEBCUS0008",
        orderNumber: order.order_id,
        declaredValue: order.shipment_details.declared_value,
        collectableValue: order.shipment_details.collectable_value || 0,
        itemDescription: order.shipment_details.item_description || "LOGISTICS SHIPMENT",
        itemQuantity: order.shipment_details.item_quantity || 1,
        height: order.shipment_details.height || 10,
        length: order.shipment_details.length || 10,
        breadth: order.shipment_details.width || 10,
        pieces: order.shipment_details.item_quantity || 1,
        weight: order.shipment_details.weight || 0.5,
        serviceType: order.shipment_details.service_type || "SDD",
        payMode: order.shipment_details.pay_mode || "PREPAID",

        // Sender Details
        shprName: order.customer_details.sender_name || "Merchant Inc",
        shprMobile: parseInt(order.customer_details.sender_mobile || "9999999999", 10),
        shprEmail: order.customer_details.sender_email || "shipping@merchant.com",
        shprAddress: order.customer_details.sender_address || "Sender address line 1",
        shprCity: order.customer_details.sender_city || "Delhi",
        shprState: order.customer_details.sender_state || "Delhi",
        shprPincode: order.customer_details.sender_pincode || 110001,
        shprCountry: "INDIA",

        // Recipient Details
        consName: order.customer_details.receiver_name,
        consMobile: parseInt(order.customer_details.receiver_mobile, 10),
        consEmail: order.customer_details.receiver_email || "receiver@customer.com",
        consAddress: order.customer_details.receiver_address,
        consCity: order.customer_details.receiver_city,
        consState: order.customer_details.receiver_state,
        consPincode: order.customer_details.receiver_pincode,
        consCountry: "INDIA",

        // Return Details
        rtnName: order.customer_details.sender_name || "Merchant Inc",
        rtnMobile: parseInt(order.customer_details.sender_mobile || "9999999999", 10),
        rtnEmail: order.customer_details.sender_email || "shipping@merchant.com",
        rtnAddress: order.customer_details.sender_address || "Sender address line 1",
        rtnCity: order.customer_details.sender_city || "Delhi",
        rtnState: order.customer_details.sender_state || "Delhi",
        rtnPincode: order.customer_details.sender_pincode || 110001,
        rtnCountry: "INDIA",
        rtnAddressType: "Seller",

        invoiceNumber: `INV-${order.order_id}`,
        invoiceDate: new Date().toISOString().split("T")[0],
        invoiceValue: order.shipment_details.declared_value,
      },
    ];

    const response = await this._request({
      method: "POST",
      url,
      data: payload,
    });

    const resData = response.data;

    return {
      courier_order_id: resData.shipment_id || resData.order_id || null,
      awb: resData.awb,
      status: "CREATED",
      raw_request: payload,
      raw_response: resData,
    };
  }

  /**
   * Implement Track Shipment
   */
  async trackShipment(awb: string): Promise<NormalizedTrackResult> {
    const url = `${this.baseUrl}/api/v1/services/tracking-pub/`;

    const response = await this._request({
      method: "GET",
      url,
      params: { awb },
    });

    const resData = response.data;

    const statusMap: { [key: string]: string } = {
      CREATED: "CREATED",
      MANIFESTED: "CREATED",
      PICKED_UP: "PICKED_UP",
      IN_TRANSIT: "IN_TRANSIT",
      OUT_FOR_DELIVERY: "IN_TRANSIT",
      DELIVERED: "DELIVERED",
      CANCELLED: "CANCELLED",
      CANCELED: "CANCELLED",
      FAILED: "FAILED",
    };

    const rawStatus = resData.current_status || "CREATED";
    const normalizedStatus = statusMap[rawStatus.toUpperCase()] || "IN_TRANSIT";

    const rawHistory = resData.tracking_history || [];
    const normalizedHistory: NormalizedTrackMilestone[] = rawHistory.map((item: any) => ({
      status: statusMap[item.status?.toUpperCase()] || "IN_TRANSIT",
      courier_status_code: item.status || "N/A",
      courier_status_message: item.remark || item.location || "N/A",
      timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
      raw_payload: item,
    }));

    return {
      status: normalizedStatus,
      tracking_history: normalizedHistory,
      raw_response: resData,
    };
  }

  /**
   * Implement Cancel Shipment
   */
  async cancelShipment(awb: string): Promise<NormalizedCancelResult> {
    const url = `${this.baseUrl}/api/v1/services/cancel/`;

    const payload = {
      awbs: awb,
    };

    const response = await this._request({
      method: "POST",
      url,
      data: payload,
    });

    const resData = response.data;

    const success = resData.success || resData.status === "CANCELLED" || false;

    return {
      success,
      status: success ? "CANCELLED" : "FAILED",
      raw_request: payload,
      raw_response: resData,
    };
  }
}

export default UrbaneBoltAdapter;
