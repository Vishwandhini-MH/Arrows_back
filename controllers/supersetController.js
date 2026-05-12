import { generateGuestToken } from "../services/supersetService.js";

export async function getSupersetGuestToken(req, res, next) {
  try {
    const guestToken = await generateGuestToken();

    res.set("Cache-Control", "no-store");
    res.status(200).json(guestToken);
  } catch (error) {
    next(error);
  }
}
