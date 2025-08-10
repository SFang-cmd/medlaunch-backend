import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, requestId, userId, ...meta }) => {
    const logEntry = {
      timestamp,
      level,
      message,
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...meta,
    };
    return JSON.stringify(logEntry);
  })
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: config.nodeEnv === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : logFormat,
    }),
  ],
});

export interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  [key: string]: unknown;
}

export const createLogger = (context: LogContext) => ({
  info: (message: string, meta?: Record<string, unknown>) => 
    logger.info(message, { ...context, ...meta }),
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => 
    logger.error(message, { ...context, error: error?.stack, ...meta }),
  warn: (message: string, meta?: Record<string, unknown>) => 
    logger.warn(message, { ...context, ...meta }),
  debug: (message: string, meta?: Record<string, unknown>) => 
    logger.debug(message, { ...context, ...meta }),
});