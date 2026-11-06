import { Router } from "express";
import { createSeller, getSeller } from "../controllers/sellers.controller.js";

const router = Router();

router.post("/", createSeller);
router.get("/:id", getSeller);

export default router;
