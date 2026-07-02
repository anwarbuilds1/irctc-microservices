import AppError from "./AppError";

export default class ConflictError extends AppError {
  constructor(message = "Resource conflict occurred") {
    super(message, 409);
  }
}
