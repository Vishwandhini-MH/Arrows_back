import { Router } from "express";

import { getSupersetGuestToken } from "../controllers/supersetController.js";

const router = Router();

router.get("/superset-token", getSupersetGuestToken);

export default router;
