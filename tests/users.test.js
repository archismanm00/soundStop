import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { pool } from "../src/db/pool.js";

const firebaseUid = `test-${randomUUID()}`;
const email = `test-${randomUUID()}@example.com`;

let userId;

describe("User API", () => {
  it("should create a user and retrieve their profile", async () => {
    const createResponse = await request(app).post("/api/users").send({
      firebase_uid: firebaseUid,
      email,
      display_name: "Test User",
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.user.email).toBe(email);

    userId = createResponse.body.user.id;

    const getResponse = await request(app).get(`/api/users/${userId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.user.id).toBe(userId);
    expect(getResponse.body.user.display_name).toBe("Test User");
  });

  it("should reject a user with missing required fields", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ display_name: "Incomplete User" });

    expect(response.status).toBe(400);
  });

  it("should return 404 for a nonexistent user", async () => {
    const response = await request(app).get(
      "/api/users/00000000-0000-0000-0000-000000000000",
    );

    expect(response.status).toBe(404);
  });
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE firebase_uid = $1", [firebaseUid]);

  await pool.end();
});
