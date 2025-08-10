import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { findUserById } from '../services/userRepository';
import { UserRole } from '../models/user';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error();

    const decoded = verifyToken(token) as any;
    const user = findUserById(decoded.id);

    if (!user) throw new Error();

    (req as any).user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', success: false });
  }
}

export function authorize(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden', success: false });
    }
    next();
  };
}