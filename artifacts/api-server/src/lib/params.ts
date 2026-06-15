import { type Request } from "express";

/**
 * Express 5 types `req.params[key]` as `string | string[] | undefined`. In
 * practice route parameters are always a single string, so this helper
 * extracts a string and throws if the param is missing.
 */
export function getParam(req: Request, name: string): string {
  const v = (req.params as Record<string, string | string[] | undefined>)[name];
  if (v === undefined) throw new Error(`Missing required param: ${name}`);
  if (Array.isArray(v)) return v[0] ?? "";
  return v;
}
