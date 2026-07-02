import { ZodType, ZodTypeAny } from "zod";
import { Request, Response, NextFunction } from "express";

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate =
  (schema: ZodType | ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema instanceof ZodType) {
        req.body = schema.parse(req.body);
      } else {
        if (schema.body) {
          req.body = schema.body.parse(req.body);
        }
        if (schema.query) {
          req.query = schema.query.parse(req.query) as any;
        }
        if (schema.params) {
          req.params = schema.params.parse(req.params) as any;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };

