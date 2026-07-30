import { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/health.service';

export class HealthController {
  public getHealth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const health = healthService.getHealth();
      res.status(200).json(health);
      return;
    } catch (error) {
      next(error);
    }
  };
}

export const healthController = new HealthController();
