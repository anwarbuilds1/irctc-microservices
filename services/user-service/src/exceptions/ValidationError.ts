import AppError from "./AppError";

export default class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 400);
  }
}
