import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { pool } from "../src/db/pool.js";

const firebaseUid = `product-test-${randomUUID()}`;
const email = `product-${randomUUID()}@example.com`;

let userId;
let sellerId;
let productId;

describe("Product API", () => {
  it("should create a user, seller, and product", async () => {
    const userResponse = await request(app).post("/api/users").send({
      firebase_uid: firebaseUid,
      email,
      display_name: "Product Test User",
    });

    expect(userResponse.status).toBe(201);
    userId = userResponse.body.user.id;

    const sellerResponse = await request(app).post("/api/sellers").send({
      user_id: userId,
      store_name: "Vinyl Heaven",
    });

    expect(sellerResponse.status).toBe(201);
    sellerId = sellerResponse.body.seller.id;

    const productResponse = await request(app).post("/api/products").send({
      seller_id: sellerId,
      title: "Abbey Road",
      description: "The Beatles vinyl record",
      price_cents: 2999,
      condition: "very_good",
      inventory_quantity: 5,
      brand: "Apple Records",
      release_year: 1969,
    });

    expect(productResponse.status).toBe(201);

    productId = productResponse.body.product.id;

    expect(productResponse.body.product.title).toBe("Abbey Road");
    expect(productResponse.body.product.price_cents).toBe("2999");
  });

  it("should retrieve a product by ID", async () => {
    const response = await request(app).get(`/api/products/${productId}`);

    expect(response.status).toBe(200);
    expect(response.body.product.title).toBe("Abbey Road");
    expect(response.body.product.store_name).toBe("Vinyl Heaven");
  });

  it("should display products in the marketplace", async () => {
    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.count).toBeGreaterThanOrEqual(1);
    expect(response.body.products.some((p) => p.id === productId)).toBe(true);
  });

  it("should reject invalid product information", async () => {
    const response = await request(app).post("/api/products").send({
      seller_id: sellerId,
      title: "",
      price_cents: -100,
      condition: "damaged",
    });

    expect(response.status).toBe(400);
  });
});

afterAll(async () => {
  if (userId) {
    await pool.query(
      `DELETE FROM products
       WHERE seller_id IN (
         SELECT id FROM seller_profiles WHERE user_id = $1
       )`,
      [userId],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  }

  await pool.end();
});
