import { UserSerializer, SerializedUser } from './user.serializer';
import { User } from '../entities/user.entity';

describe('UserSerializer', () => {
  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    portfolios: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  };

  describe('serialize', () => {
    it('should serialize a user without sensitive data', () => {
      const result = UserSerializer.serialize(mockUser);

      expect(result).toEqual({
        id: '123',
        email: 'test@example.com',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should not include passwordHash in serialized output', () => {
      const result = UserSerializer.serialize(mockUser);

      expect(result).not.toHaveProperty('passwordHash');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should not include portfolios in serialized output', () => {
      const result = UserSerializer.serialize(mockUser);

      expect(result).not.toHaveProperty('portfolios');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).portfolios).toBeUndefined();
    });
  });

  describe('serializeMany', () => {
    it('should serialize multiple users', () => {
      const users: User[] = [
        mockUser,
        { ...mockUser, id: '456', email: 'user2@example.com' },
      ];

      const result = UserSerializer.serializeMany(users);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('123');
      expect(result[1].id).toBe('456');
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result[1]).not.toHaveProperty('passwordHash');
    });

    it('should return empty array for empty input', () => {
      const result = UserSerializer.serializeMany([]);

      expect(result).toEqual([]);
    });
  });

  describe('serializeOrNull', () => {
    it('should serialize a user when provided', () => {
      const result = UserSerializer.serializeOrNull(mockUser);

      expect(result).toEqual({
        id: '123',
        email: 'test@example.com',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should return null when user is null', () => {
      const result = UserSerializer.serializeOrNull(null);

      expect(result).toBeNull();
    });
  });

  describe('type safety', () => {
    it('should enforce SerializedUser type', () => {
      const result: SerializedUser = UserSerializer.serialize(mockUser);

      // TypeScript compilation ensures these properties exist
      expect(result.id).toBeDefined();
      expect(result.email).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });
});
