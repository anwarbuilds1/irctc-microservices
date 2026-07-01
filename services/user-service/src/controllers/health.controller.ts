import { Request, Response } from "express";
import { healthService } from "../services/health.service";

export class HealthController {
  getHealth(_req: Request, res: Response) {
    const result = healthService.getHealth();

    return res.status(200).json(result);
  }
}

export const healthController = new HealthController();
