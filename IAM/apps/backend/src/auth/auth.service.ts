import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { UsersService } from '../users/users.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;
  private readonly appleJwksClient: jwksRsa.JwksClient;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );

    this.appleJwksClient = jwksRsa({
      jwksUri: 'https://appleid.apple.com/auth/keys',
      cache: true,
      rateLimit: true,
    });
  }

  /**
   * Autentica con Google ID Token.
   * Verifica el token, crea/recupera el usuario en DB, emite JWT propio.
   */
  async loginWithGoogle(idToken: string): Promise<AuthTokens & { user: unknown }> {
    let payload;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.error(`Google token verification failed: ${String(err)}`);
      throw new UnauthorizedException('AUTH_INVALID_TOKEN');
    }

    if (!payload?.email || !payload?.sub) {
      throw new UnauthorizedException('AUTH_INVALID_TOKEN');
    }

    const user = await this.usersService.findOrCreate({
      email: payload.email,
      authProvider: 'google',
      authId: payload.sub,
      displayName: payload.name ?? null,
    });

    const tokens = this.generateTokens({ sub: user.id, email: user.email });

    // Update streak on login
    await this.usersService.updateStreak(user.id);

    return { ...tokens, user };
  }

  /**
   * Autentica con Apple ID Token.
   * Verifica el JWT contra las JWKS de Apple, crea/recupera usuario.
   */
  async loginWithApple(idToken: string): Promise<AuthTokens & { user: unknown }> {
    let decoded: jwt.JwtPayload;

    try {
      // Decode header to get kid
      const header = jwt.decode(idToken, { complete: true })?.header;
      if (!header?.kid) {
        throw new Error('Missing kid in token header');
      }

      // Get Apple's public key
      const key = await this.appleJwksClient.getSigningKey(header.kid);
      const publicKey = key.getPublicKey();

      // Verify token
      decoded = jwt.verify(idToken, publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
      }) as jwt.JwtPayload;
    } catch (err) {
      this.logger.error(`Apple token verification failed: ${String(err)}`);
      throw new UnauthorizedException('AUTH_INVALID_TOKEN');
    }

    if (!decoded.email || !decoded.sub) {
      throw new UnauthorizedException('AUTH_INVALID_TOKEN');
    }

    const user = await this.usersService.findOrCreate({
      email: decoded.email as string,
      authProvider: 'apple',
      authId: decoded.sub,
      displayName: null,
    });

    const tokens = this.generateTokens({ sub: user.id, email: user.email });

    await this.usersService.updateStreak(user.id);

    return { ...tokens, user };
  }

  /**
   * Refresca un access token usando un refresh token válido.
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      const accessToken = this.jwtService.sign(
        { sub: payload.sub, email: payload.email },
        { expiresIn: '15m' },
      );

      return { accessToken };
    } catch {
      throw new UnauthorizedException('AUTH_REFRESH_EXPIRED');
    }
  }

  private generateTokens(payload: JwtPayload): AuthTokens {
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }
}
