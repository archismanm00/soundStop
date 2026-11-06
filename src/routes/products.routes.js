import { Router } from "express";

import {
  createProduct,
  getProduct,
  getProducts,
  addProductCategories,
  getProductCategories,
} from "../controllers/products.controller.js";

const router = Router();

router.post("/", createProduct);
router.get("/", getProducts);
router.post("/:id/categories", addProductCategories);
router.get("/:id/categories", getProductCategories);
router.get("/:id", getProduct);

export default router;
