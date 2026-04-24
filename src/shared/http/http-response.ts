import { Response } from "express";

export const sendSuccess = (res: Response, statusCode: number, payload: object = {}) => {
  return res.status(statusCode).json({
    erro: false,
    requestId: res.locals.requestId,
    ...payload,
  });
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details: unknown = null,
) => {
  return res.status(statusCode).json({
    erro: true,
    code,
    message,
    details,
    requestId: res.locals.requestId,
  });
};
