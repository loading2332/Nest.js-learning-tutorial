import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserRole } from '../../generated/client';
import { JwtAuthGuard } from './jwt-auth.guard';

type RequestWithUser = Request & {
  user?: {
    id: number;
    email: string;
    role: UserRole;
  };
};

function createExecutionContext(request: RequestWithUser): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T = RequestWithUser>() => request as T,
      getResponse: jest.fn(),
      getNext: jest.fn(),
    }),
  } as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('attaches current user to request when token is valid', async () => {
    const request = {
      headers: {
        authorization: 'Bearer valid-token',
      },
    } as RequestWithUser;

    jwtService.verifyAsync.mockResolvedValue({
      sub: 1,
      email: 'alice@example.com',
      role: UserRole.student,
    });

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
      secret: 'test-secret',
    });
    expect(request.user).toEqual({
      id: 1,
      email: 'alice@example.com',
      role: UserRole.student,
    });
  });

  it('throws 401 when token is missing', async () => {
    const request = {
      headers: {},
    } as RequestWithUser;

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
