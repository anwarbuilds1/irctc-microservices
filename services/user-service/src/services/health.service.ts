export class HealthService {
  public getHealth() {
    return {
      status: 'UP',
      service: 'user-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
