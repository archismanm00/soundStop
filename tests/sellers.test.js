import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { pool } from "../src/db/pool.js";

const firebaseUid = `seller-test-${randomUUID()}`;
const email = `seller-${randomUUID()}@example.com`;

let sellerId;
let userId;

describe("Seller API", () => {
  it("should create a user and seller profile", async () => {
    const userResponse = await request(app).post("/api/users").send({
      firebase_uid: firebaseUid,
      email,
      display_name: "Seller Test",
    });

    expect(userResponse.status).toBe(201);

    userId = userResponse.body.user.id;

    const sellerResponse = await request(app).post("/api/sellers").send({
      user_id: userId,
      store_name: "Test Records",
      store_description: "A record store for testing",
    });

    expect(sellerResponse.status).toBe(201);
    expect(sellerResponse.body.seller.store_name).toBe("Test Records");

    sellerId = sellerResponse.body.seller.id;
  });

  it("should retrieve a seller profile", async () => {
    const response = await request(app).get(`/api/sellers/${sellerId}`);

    expect(response.status).toBe(200);
    expect(response.body.seller.user_id).toBe(userId);
  });

  it("should reject an invalid seller request", async () => {
    const response = await request(app)
      .post("/api/sellers")
      .send({ store_name: "Invalid Store" });

    expect(response.status).toBe(400);
  });
});

afterAll(async () => {
  if (userId) {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  }

  await pool.end();
});
