import { Controller, Post, Body, Get, Req, Res, HttpCode, HttpStatus, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto, AuthTokens } from '@prompt-site-builder/shared';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string): void {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      domain: isProd ? this.configService.get<string>('BASE_DOMAIN') : undefined,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response): Promise<Omit<AuthTokens, 'refreshToken'>> {
    const tokens = await this.authService.register(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<Omit<AuthTokens, 'refreshToken'>> {
    const tokens = await this.authService.login(dto);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ): Promise<Omit<AuthTokens, 'refreshToken'>> {
    const refreshToken = req.cookies?.refresh_token || bodyRefreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const tokens = await this.authService.refreshToken(refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and clear refresh token cookie' })
  async logout(@Res({ passthrough: true }) res: Response): Promise<void> {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie('refresh_token', {
      path: '/',
      domain: isProd ? this.configService.get<string>('BASE_DOMAIN') : undefined,
    });
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user info' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  getMe(@Req() req: Request) {
    return req.user;
  }
}
