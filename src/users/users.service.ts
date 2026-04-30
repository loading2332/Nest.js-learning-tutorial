import { Injectable } from '@nestjs/common';
import { UserRole } from '../generated/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateUserInput = {
  email: string;
  name: string;
  passwordHash: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createAt: true,
        updateAt: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: UserRole.student,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createAt: true,
        updateAt: true,
      },
    });
  }
}
