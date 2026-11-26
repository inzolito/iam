import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MatchingService } from './matching.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { id: string; email: string; isTeen: boolean };
}

interface SwipeDto {
  targetUserId: string;
  direction: 'like' | 'pass';
}

interface BlockDto {
  userId: string;
}

interface ReportDto {
  userId: string;
  reason: string;
  description?: string;
}

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get()
  async getFeed(
    @Req() req: AuthRequest,
    @Query('radius') radius?: string,
    @Query('page') page?: string,
    @Query('genders') genders?: string,
    @Query('diagnoses') diagnoses?: string,
    @Query('minAge') minAge?: string,
    @Query('maxAge') maxAge?: string,
    @Query('tags') tags?: string,
    @Query('minEnergy') minEnergy?: string,
    @Query('sort') sort?: string,
  ) {
    const radiusMeters = radius ? parseInt(radius, 10) : undefined;
    const pageNum = page ? Math.max(0, parseInt(page, 10)) : 0;
    const parseCsv = (val?: string) =>
      val ? val.split(',').map((v) => v.trim()).filter(Boolean) : undefined;

    const genderList = parseCsv(genders);
    const diagnosisList = parseCsv(diagnoses);
    const tagList = parseCsv(tags);
    const minAgeNum = minAge ? parseInt(minAge, 10) : undefined;
    const maxAgeNum = maxAge ? parseInt(maxAge, 10) : undefined;
    const minEnergyNum = minEnergy ? parseInt(minEnergy, 10) : undefined;

    const profiles = await this.matchingService.getFeed(
      req.user.id,
      radiusMeters,
      pageNum,
      genderList,
      {
        diagnoses: diagnosisList,
        minAge: Number.isFinite(minAgeNum) ? minAgeNum : undefined,
        maxAge: Number.isFinite(maxAgeNum) ? maxAgeNum : undefined,
        tagIds: tagList,
        minEnergyLevel: Number.isFinite(minEnergyNum) ? minEnergyNum : undefined,
        sort: sort === 'distance' || sort === 'recent' ? sort : 'compatibility',
      },
    );

    return { profiles };
  }
}

@Controller('swipes')
@UseGuards(JwtAuthGuard)
export class SwipeController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  async swipe(@Req() req: AuthRequest, @Body() body: SwipeDto) {
    if (!body.targetUserId || !body.direction) {
      throw new BadRequestException('MISSING_FIELDS');
    }

    const result = await this.matchingService.swipe(
      req.user.id,
      body.targetUserId,
      body.direction,
    );

    return result;
  }
}

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlockController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  async block(@Req() req: AuthRequest, @Body() body: BlockDto) {
    if (!body.userId) {
      throw new BadRequestException('MISSING_USER_ID');
    }

    await this.matchingService.blockUser(req.user.id, body.userId);
    return { ok: true };
  }
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post()
  async report(@Req() req: AuthRequest, @Body() body: ReportDto) {
    if (!body.userId || !body.reason) {
      throw new BadRequestException('MISSING_FIELDS');
    }

    await this.matchingService.reportUser(
      req.user.id,
      body.userId,
      body.reason,
      body.description,
    );

    return { ok: true };
  }
}
