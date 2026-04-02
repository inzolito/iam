import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, Put } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VenuesService } from './venues.service';

@Controller('venues')
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  /**
   * GET /venues/nearby
   * Buscar venues cercanos (requiere coordenadas)
   */
  @Get('nearby')
  async getNearbyVenues(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('category') category?: string,
  ) {
    return this.venuesService.getNearbyVenues(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : 5000,
      category,
    );
  }

  /**
   * GET /venues/nearby/me
   * Buscar venues cercanos (usa user_id para favoritos)
   */
  @UseGuards(JwtAuthGuard)
  @Get('nearby/me')
  async getNearbyVenuesForUser(
    @Request() req: any,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
    @Query('category') category?: string,
  ) {
    return this.venuesService.getNearbyVenues(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : 5000,
      category,
      req.user.id,
    );
  }

  /**
   * GET /venues/search
   * Buscar venues por nombre
   */
  @Get('search')
  async searchVenues(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.venuesService.searchVenues(
      query,
      limit ? parseInt(limit) : 10,
    );
  }

  /**
   * GET /venues/:id
   * Detalle de un venue
   */
  @Get(':id')
  async getVenueDetail(@Param('id') id: string) {
    return this.venuesService.getVenueDetail(id);
  }

  /**
   * GET /venues/:id/detail
   * Detalle de un venue con info del usuario (favorito)
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/detail')
  async getVenueDetailForUser(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.venuesService.getVenueDetail(id, req.user.id);
  }

  /**
   * POST /venues/:id/checkin
   * Hacer check-in en un venue
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/checkin')
  async checkIn(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.venuesService.checkIn(
      req.user.id,
      id,
      body.lat,
      body.lng,
    );
  }

  /**
   * GET /venues/user/checkins
   * Historial de check-ins del usuario
   */
  @UseGuards(JwtAuthGuard)
  @Get('user/checkins')
  async getUserCheckins(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.venuesService.getUserCheckins(
      req.user.id,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }

  /**
   * GET /venues/:id/reviews
   * Reviews de un venue
   */
  @Get(':id/reviews')
  async getVenueReviews(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.venuesService.getVenueReviews(
      id,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }

  /**
   * POST /venues/:id/review
   * Crear o actualizar review
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/review')
  async upsertReview(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      rating: number;
      sensoryRating?: number;
      comment?: string;
      tags?: string[];
    },
  ) {
    return this.venuesService.upsertReview(
      req.user.id,
      id,
      body.rating,
      body.sensoryRating,
      body.comment,
      body.tags,
    );
  }

  /**
   * POST /venues/:id/favorite
   * Toggle favorito
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  async toggleFavorite(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.venuesService.toggleFavorite(req.user.id, id);
  }

  /**
   * GET /venues/user/favorites
   * Obtener favoritos del usuario
   */
  @UseGuards(JwtAuthGuard)
  @Get('user/favorites')
  async getUserFavorites(@Request() req: any) {
    return this.venuesService.getUserFavorites(req.user.id);
  }
}
