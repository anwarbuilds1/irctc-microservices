import { healthRepository } from "../repositories/health.repository";

export class HealthService {
  getHealth() {
    return {
      ...healthRepository.getHealthStatus(),
      service: "user-service",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
