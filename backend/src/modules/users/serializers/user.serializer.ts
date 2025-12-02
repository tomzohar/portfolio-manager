import { User } from '../entities/user.entity';

/**
 * Safe user representation without sensitive data
 */
export interface SerializedUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserSerializer
 *
 * Transforms User entities into safe serialized objects
 * that exclude sensitive fields like passwordHash.
 *
 * This ensures consistent and secure user data serialization
 * across all API endpoints.
 */
export class UserSerializer {
  /**
   * Serialize a single user entity
   * @param user User entity to serialize
   * @returns Safe user object without sensitive data
   */
  static serialize(user: User): SerializedUser {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Serialize an array of user entities
   * @param users Array of user entities to serialize
   * @returns Array of safe user objects
   */
  static serializeMany(users: User[]): SerializedUser[] {
    return users.map((user) => this.serialize(user));
  }

  /**
   * Serialize a user entity or null
   * @param user User entity or null
   * @returns Safe user object or null
   */
  static serializeOrNull(user: User | null): SerializedUser | null {
    if (!user) {
      return null;
    }
    return this.serialize(user);
  }
}
