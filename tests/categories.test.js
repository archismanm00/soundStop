import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

import app from "../src/app.js";
import { pool } from "../src/db/pool.js";

const uniqueId = randomUUID();

const categoryName = `Test Vinyl ${uniqueId.slice(0, 8)}`;
const categorySlug = `test-vinyl-${uniqueId}`;

let categoryId;

describe("Category API", () => {
  it("should create a category", async () => {
    const response = await request(app).post("/api/categories").send({
      name: categoryName,
      slug: categorySlug,
      description: "Test category",
    });

    expect(response.status).toBe(201);
    expect(response.body.category.name).toBe(categoryName);
    expect(response.body.category.slug).toBe(categorySlug);

    categoryId = response.body.category.id;
  });

  it("should list categories", async () => {
    const response = await request(app).get("/api/categories");

    expect(response.status).toBe(200);
    expect(response.body.count).toBeGreaterThanOrEqual(1);

    expect(
      response.body.categories.some((category) => category.id === categoryId),
    ).toBe(true);
  });

  it("should reject invalid category information", async () => {
    const response = await request(app).post("/api/categories").send({
      name: "",
      slug: "Invalid Slug!",
    });

    expect(response.status).toBe(400);
  });
});

afterAll(async () => {
  if (categoryId) {
    await pool.query("DELETE FROM categories WHERE id = $1", [categoryId]);
  }

  await pool.end();
});
