import { pool } from "../db/pool.js";

export async function createUser(req, res) {
  const { firebase_uid, email, display_name } = req.body;

  if (
    typeof firebase_uid !== "string" ||
    !firebase_uid.trim() ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    (display_name != null && typeof display_name !== "string")
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid Firebase UID and email are required",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO users (firebase_uid, email, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, profile_image_url, created_at`,
      [
        firebase_uid.trim(),
        email.trim().toLowerCase(),
        display_name?.trim() || null,
      ],
    );

    return res.status(201).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A user with this Firebase UID or email already exists",
      });
    }

    console.error("Create user failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create user",
    });
  }
}

export async function getUser(req, res) {
  const { id } = req.params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, display_name, profile_image_url, created_at
       FROM users
       WHERE id = $1`,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Get user failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve user",
    });
  }
}
