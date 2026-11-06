import express from "express";
import helmet from "helmet";
import cors from "cors";
import sellersRoutes from "./routes/sellers.routes.js";
import productsRoutes from "./routes/products.routes.js";

import healthRoutes from "./routes/health.routes.js";
import usersRoutes from "./routes/users.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/sellers", sellersRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/categories", categoriesRoutes);

export default app;
