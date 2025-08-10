import { findUserByEmail } from './userRepository';
import { User } from "@/models/user";

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// Creates a new jwt for an authenticated user
export function generateToken(user: User) {
    const payload = {
        id: user.id,
        role: user.role
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    return token;
}

// For token verification to ensure that it is a valid JWT
// As well as within the time limit
export function verifyToken(token: string) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;

    } catch (error) {
        throw new Error('Invalid token');
    }
}

// For future password hashing/updating
export async function hashPassword(password: string) {
    return bcrypt.hash(password, 10);
}

// For password verification
export async function comparePassword(password: string, hashedPassword: string) {
    return bcrypt.compare(password, hashedPassword);
}

// Login logic
export async function login(email: string, password: string) {
    // Find user
    const user = findUserByEmail(email);
    if (!user || !user.isActive) {
        throw new Error('Invalid User');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
        throw new Error('Invalid password');
    }

    return {
        token: generateToken(user),
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
        },
        expiresIn: '24h'
    }
}
