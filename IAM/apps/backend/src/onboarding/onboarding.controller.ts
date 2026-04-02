import {
  Controller,
  Patch,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';

interface AuthRequest {
  user: { id: string; email: string; isTeen: boolean };
}

// ── DTOs ──

interface UpdateProfileDto {
  username?: string;
  displayName?: string;
  birthDate?: string; // YYYY-MM-DD
  msnStatus?: string;
  energyLevel?: number;
  notifLevel?: number;
}

interface SetDiagnosesDto {
  diagnoses: string[]; // ['TEA', 'AACC', ...]
  primary: string; // 'TEA'
}

interface SetSpinDto {
  tagIds: string[]; // UUIDs
}

interface CreateCustomTagDto {
  displayName: string;
  categoryId: string;
}

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('profile')
  async getProfile(@Req() req: AuthRequest) {
    return this.onboardingService.getProfile(req.user.id);
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: AuthRequest,
    @Body() body: UpdateProfileDto,
  ) {
    return this.onboardingService.updateProfile(req.user.id, body);
  }

  @Post('diagnoses')
  async setDiagnoses(
    @Req() req: AuthRequest,
    @Body() body: SetDiagnosesDto,
  ) {
    if (!body.diagnoses || body.diagnoses.length === 0) {
      throw new BadRequestException('DIAGNOSES_REQUIRED: debes seleccionar al menos un diagnóstico');
    }
    if (!body.primary) {
      throw new BadRequestException('PRIMARY_REQUIRED: debes indicar el diagnóstico principal');
    }
    return this.onboardingService.setDiagnoses(req.user.id, body.diagnoses, body.primary);
  }

  @Get('diagnoses')
  async getDiagnoses(@Req() req: AuthRequest) {
    return this.onboardingService.getDiagnoses(req.user.id);
  }

  @Post('spin')
  async setSpin(@Req() req: AuthRequest, @Body() body: SetSpinDto) {
    return this.onboardingService.setSpin(req.user.id, body.tagIds);
  }

  @Get('spin')
  async getSpin(@Req() req: AuthRequest) {
    return this.onboardingService.getSpin(req.user.id);
  }

  @Post('spin/custom-tag')
  async createCustomTag(
    @Req() req: AuthRequest,
    @Body() body: CreateCustomTagDto,
  ) {
    if (!body.displayName || body.displayName.trim().length < 2) {
      throw new BadRequestException('TAG_NAME_REQUIRED: nombre del tag debe tener al menos 2 caracteres');
    }
    if (!body.categoryId) {
      throw new BadRequestException('CATEGORY_REQUIRED: debes indicar la categoría');
    }
    return this.onboardingService.createCustomTag(body.displayName, body.categoryId);
  }

  @Post('complete')
  async completeOnboarding(@Req() req: AuthRequest) {
    return this.onboardingService.completeOnboarding(req.user.id);
  }
}
