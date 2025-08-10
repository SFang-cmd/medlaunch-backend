import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.headers['x-request-id'] = requestId;

  const logger = createLogger({ requestId });
  
  const startTime = Date.now();

  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    query: req.query,
  });

  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      responseSize: Buffer.byteLength(body),
    });

    return originalSend.call(this, body);
  };

  res.setHeader('X-Request-ID', requestId);
  next();
};