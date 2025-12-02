import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserSerializer, SerializedUser } from './serializers/user.serializer';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * Create a new user
   * Returns serialized user without sensitive data
   */
  async create(createUserDto: CreateUserDto): Promise<SerializedUser> {
    const { email, password } = createUserDto;

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    const user = this.usersRepository.create({
      email,
      passwordHash,
    });

    const savedUser = await this.usersRepository.save(user);
    return UserSerializer.serialize(savedUser);
  }

  /**
   * Find user by ID (for internal use, returns full entity)
   * For API responses, use findOneSerialized instead
   */
  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Find user by ID and return serialized version
   * Safe for API responses
   */
  async findOneSerialized(id: string): Promise<SerializedUser | null> {
    const user = await this.findOne(id);
    return UserSerializer.serializeOrNull(user);
  }

  /**
   * Find user by email
   * By default, passwordHash is excluded. Use includePassword: true for authentication.
   */
  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email });

    if (includePassword) {
      query.addSelect('user.passwordHash');
    }

    return query.getOne();
  }
}
