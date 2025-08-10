import { User, UserRole } from '../models/user';
import bcrypt from 'bcryptjs';

// Sample users with plain passwords for demo purposes
const sampleUsers: Array<User> = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'reader@medlaunch.com',
    name: 'Jane Reader',
    role: UserRole.READER,
    passwordHash: bcrypt.hashSync('ReadPass123', 10),
    createdAt: new Date('2025-08-10'),
    updatedAt: new Date('2025-08-10'),
    isActive: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'editor@medlaunch.com',
    name: 'John Editor',
    role: UserRole.EDITOR,
    passwordHash: bcrypt.hashSync('EditPass123', 10),
    createdAt: new Date('2025-08-10'),
    updatedAt: new Date('2025-08-10'),
    isActive: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'admin@medlaunch.com',
    name: 'Alice Admin',
    role: UserRole.ADMIN,
    passwordHash: bcrypt.hashSync('AdminPass123', 10),
    createdAt: new Date('2025-08-10'),
    updatedAt: new Date('2025-08-10'),
    isActive: true,
  },
];

export const findUserByEmail = (email: string) => {
  return sampleUsers.find(user => user.email === email);
};

export const findUserById = (id: string) => {
  return sampleUsers.find(user => user.id === id);
};

export const createUser = (user: User) => {
  sampleUsers.push(user); 
}

export const updateUser = (user: User) => {
  const index = sampleUsers.findIndex(user => user.id === user.id);
  if (index !== -1) {
    sampleUsers[index] = user;
  }
}

export const deleteUser = (id: string) => {
  const index = sampleUsers.findIndex(user => user.id === id);
  if (index !== -1) {
    sampleUsers.splice(index, 1);
  }
}

export { sampleUsers };