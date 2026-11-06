import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";

import app from "../src/app.js";
import { pool } from "../src/db/pool.js";

describe("GET /api/health", () => {
  it("should return a successful response when the database is connected", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("SoundStop API is running");
    expect(response.body.database).toBe("Connected");
    expect(response.body.timestamp).toBeDefined();
  });
});

afterAll(async () => {
  await pool.end();
});
