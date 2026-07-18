import type { ErrorObject, ValidateFunction } from "ajv";
import type { WidgetSpec } from "../types.js";

declare const validate: ValidateFunction<WidgetSpec> & {
  errors?: ErrorObject[] | null;
};

export { validate };
export default validate;
