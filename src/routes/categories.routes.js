import { Router } from "express";

import {
  createCategory,
  getCategories,
} from "../controllers/categories.controller.js";

const router = Router();

router.get("/", getCategories);
router.post("/", createCategory);

export default router;
