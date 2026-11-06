import { pool } from "../db/pool.js";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// List active categories
export async function getCategories(req, res) {
  try {
    const result = await pool.query(
      `SELECT
        id,
        name,
        slug,
        description,
        parent_id,
        is_active
      FROM categories
      WHERE is_active = TRUE
      ORDER BY name ASC`,
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      categories: result.rows,
    });
  } catch (error) {
    console.error("Get categories failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve categories",
    });
  }
}

// Create a category
export async function createCategory(req, res) {
  const { name, slug, description, parent_id } = req.body;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    (description != null && typeof description !== "string") ||
    (parent_id != null && !uuidRegex.test(parent_id))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid category information",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO categories (
        name,
        slug,
        description,
        parent_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [name.trim(), slug, description || null, parent_id || null],
    );

    return res.status(201).json({
      success: true,
      category: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Category name or slug already exists",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    console.error("Create category failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create category",
    });
  }
}
