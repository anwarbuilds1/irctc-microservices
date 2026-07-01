export class HealthRepository {
  getHealthStatus() {
    return {
      status: "UP",
    };
  }
}

export const healthRepository = new HealthRepository();
