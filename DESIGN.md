# How the System Works (Design Guide)

This is a simple guide on how our Multi-Courier Integration Platform is put together.

---

## 1. The Big Picture (Architecture)

We separate our code into clear layers so everything is easy to maintain. 

* **Client** makes a request.
* **Routes** map it to the right place.
* **Controllers** handle the main business logic.
* **Database** stores the records.
* **Adapters** talk to the third-party courier APIs.

---

## 2. Dynamic Courier Integration (Design Patterns)

To make it super easy to add new courier partners without changing our existing code:

1. **The Standard Adapter (`BaseCourierAdapter`)**:
   Think of this as a contract. Every courier partner we add must implement the same basic actions: `createShipment`, `trackShipment`, and `cancelShipment`. This ensures all courier integration code behaves the same way.

2. **The Factory (`CourierFactory`)**:
   A registry that looks at the courier name (like `urbanebolt` or `mockcourier`) and instantiates the correct adapter automatically. Tomorrow, if we add a new partner, we just write its adapter and register it here. The rest of the app doesn't have to change at all.

---

## 3. Database Collections

We use three simple collections:

* **Orders**: Stores the main shipment details, status, and tracking numbers (AWB).
* **Tracking History**: Keeps an append-only timeline of where the shipment has been. To keep this timeline accurate, we block any updates or deletes on this collection.
* **Batches**: Tracks progress when someone uploads up to 100 orders at once.

---

## 4. Handling High Volume & Network Issues

* **Background Processing**: When a client requests a bulk creation of up to 100 orders, we don't make them wait. We instantly return a `batch_id` and process the orders in the background. The client can poll the batch endpoint to see the progress.
* **Smart Retries**: If a courier API fails due to a temporary network issue, the system automatically retries with an increasing delay (exponential backoff).
* **Auto-Login**: If a courier token expires (causing a `401 Unauthorized` error), the adapter automatically logs in again, gets a fresh token, and retries the request without complaining to the user.