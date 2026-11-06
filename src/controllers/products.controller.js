import { pool } from "../db/pool.js";

const conditions = ["new", "like_new", "very_good", "good", "acceptable"];

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Create a product
export async function createProduct(req, res) {
  const {
    seller_id,
    title,
    description,
    price_cents,
    condition,
    inventory_quantity = 1,
    brand,
    release_year,
  } = req.body;

  if (
    !uuidRegex.test(seller_id || "") ||
    typeof title !== "string" ||
    !title.trim() ||
    !Number.isInteger(price_cents) ||
    price_cents < 0 ||
    !conditions.includes(condition) ||
    !Number.isInteger(inventory_quantity) ||
    inventory_quantity < 0 ||
    (release_year != null &&
      (!Number.isInteger(release_year) ||
        release_year < 1000 ||
        release_year > 9999))
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid product information",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO products (
        seller_id,
        title,
        description,
        price_cents,
        condition,
        inventory_quantity,
        brand,
        release_year,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
      RETURNING *`,
      [
        seller_id,
        title.trim(),
        description || null,
        price_cents,
        condition,
        inventory_quantity,
        brand || null,
        release_year || null,
      ],
    );

    return res.status(201).json({
      success: true,
      product: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    console.error("Create product failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create product",
    });
  }
}

// Retrieve a single product
export async function getProduct(req, res) {
  const { id } = req.params;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
        p.*,
        s.store_name,
        (
          SELECT image_url
          FROM product_images
          WHERE product_id = p.id AND is_primary = TRUE
          LIMIT 1
        ) AS primary_image_url
      FROM products p
      JOIN seller_profiles s ON p.seller_id = s.id
      WHERE p.id = $1 AND p.status = 'active'`,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Get product failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve product",
    });
  }
}

// Browse active products
export async function getProducts(req, res) {
  const limit = Number.parseInt(req.query.limit ?? "20", 10);
  const offset = Number.parseInt(req.query.offset ?? "0", 10);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid pagination parameters",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
        p.id,
        p.seller_id,
        p.title,
        p.description,
        p.price_cents,
        p.condition,
        p.inventory_quantity,
        p.brand,
        p.release_year,
        p.created_at,
        s.store_name,
        (
          SELECT image_url
          FROM product_images
          WHERE product_id = p.id AND is_primary = TRUE
          LIMIT 1
        ) AS primary_image_url
      FROM products p
      JOIN seller_profiles s ON p.seller_id = s.id
      WHERE p.status = 'active'
        AND p.inventory_quantity > 0
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      products: result.rows,
    });
  } catch (error) {
    console.error("Browse products failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve products",
    });
  }
}

// Assign categories to a product
export async function addProductCategories(req, res) {
  const { id } = req.params;
  const { category_ids } = req.body;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  if (
    !Array.isArray(category_ids) ||
    category_ids.length === 0 ||
    !category_ids.every(
      (categoryId) =>
        typeof categoryId === "string" && uuidRegex.test(categoryId),
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "category_ids must be a non-empty array of valid UUIDs",
    });
  }

  const uniqueCategoryIds = [...new Set(category_ids)];

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const product = await client.query(
      "SELECT id FROM products WHERE id = $1",
      [id],
    );

    if (product.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const categories = await client.query(
      `SELECT id
       FROM categories
       WHERE id = ANY($1::uuid[])
       AND is_active = TRUE`,
      [uniqueCategoryIds],
    );

    if (categories.rowCount !== uniqueCategoryIds.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "One or more categories were not found or are inactive",
      });
    }

    const result = await client.query(
      `INSERT INTO product_categories (product_id, category_id)
       SELECT $1, category_id
       FROM UNNEST($2::uuid[]) AS input(category_id)
       ON CONFLICT (product_id, category_id) DO NOTHING
       RETURNING category_id`,
      [id, uniqueCategoryIds],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Product categories updated",
      added_count: result.rowCount,
      category_ids: result.rows.map((row) => row.category_id),
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    console.error("Add product categories failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not assign categories to product",
    });
  } finally {
    client?.release();
  }
}

// Retrieve categories assigned to a product
export async function getProductCategories(req, res) {
  const { id } = req.params;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID",
    });
  }

  try {
    const product = await pool.query("SELECT id FROM products WHERE id = $1", [
      id,
    ]);

    if (product.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const result = await pool.query(
      `SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.parent_id
       FROM product_categories pc
       JOIN categories c ON c.id = pc.category_id
       WHERE pc.product_id = $1
       AND c.is_active = TRUE
       ORDER BY c.name ASC`,
      [id],
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      categories: result.rows,
    });
  } catch (error) {
    console.error("Get product categories failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve product categories",
    });
  }
}
