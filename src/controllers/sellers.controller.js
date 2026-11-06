import { pool } from "../db/pool.js";

export async function createSeller(req, res) {
  const { user_id, store_name, store_description } = req.body;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    !uuidRegex.test(user_id || "") ||
    typeof store_name !== "string" ||
    !store_name.trim() ||
    (store_description != null && typeof store_description !== "string")
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid user ID and store name are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO seller_profiles (user_id, store_name, store_description)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, store_name, store_description, is_active, created_at`,
      [user_id, store_name.trim(), store_description?.trim() || null],
    );

    return res.status(201).json({
      success: true,
      seller: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This user already has a seller profile",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.error("Create seller failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create seller profile",
    });
  }
}

export async function getSeller(req, res) {
  const { id } = req.params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid seller ID",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, user_id, store_name, store_description, is_active, created_at
       FROM seller_profiles
       WHERE id = $1`,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      success: true,
      seller: result.rows[0],
    });
  } catch (error) {
    console.error("Get seller failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve seller profile",
    });
  }
}
