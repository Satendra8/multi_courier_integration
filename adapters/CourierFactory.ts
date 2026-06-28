import BaseCourierAdapter from "./BaseCourierAdapter.js";
import UrbaneBoltAdapter from "./UrbaneBoltAdapter.js";
import MockCourierAdapter from "./MockCourierAdapter.js";
import ErrorHandler from "../middlewares/error.js";

type AdapterConstructor = new () => BaseCourierAdapter;

export class CourierFactory {
  static registry: { [key: string]: AdapterConstructor } = {
    urbanebolt: UrbaneBoltAdapter,
    mockcourier: MockCourierAdapter,
  };

  /**
   * Register a new courier adapter dynamically
   * @param partnerName - Courier name (e.g. 'delhivery')
   * @param adapterClass - Adapter class extending BaseCourierAdapter
   */
  static registerAdapter(partnerName: string, adapterClass: AdapterConstructor): void {
    this.registry[partnerName.toLowerCase()] = adapterClass;
    console.log(`[CourierFactory] Registered new adapter for partner: ${partnerName.toLowerCase()}`);
  }

  /**
   * Resolve and return courier adapter instance
   * @param partnerName - Courier name
   */
  static getAdapter(partnerName: string): BaseCourierAdapter {
    if (!partnerName) {
      throw new ErrorHandler(
        "courier_partner parameter is required",
        400,
        "INVALID_COURIER_PARTNER",
        { supported_couriers: Object.keys(this.registry) }
      );
    }

    const normalizedPartner = partnerName.toLowerCase();
    const AdapterClass = this.registry[normalizedPartner];

    if (!AdapterClass) {
      throw new ErrorHandler(
        `Unknown courier partner: '${partnerName}'.`,
        400,
        "UNKNOWN_COURIER_PARTNER",
        { supported_couriers: Object.keys(this.registry) }
      );
    }

    return new AdapterClass();
  }

  /**
   * Get list of all supported couriers
   */
  static getSupportedCouriers(): string[] {
    return Object.keys(this.registry);
  }
}

export default CourierFactory;
