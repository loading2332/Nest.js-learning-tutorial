import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from 'argon2';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(input: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(input.email);
    if (existingUser) {
      throw new BadRequestException('email already registered');
    }

    const passwordHash = await hash(input.password);

    return this.usersService.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
  }

  async login(input: LoginDto) {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('email or password is incorrect');
    }

    const isPasswordValid = await verify(user.passwordHash, input.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('email or password is incorrect');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
