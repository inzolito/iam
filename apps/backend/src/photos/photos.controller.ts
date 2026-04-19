import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PhotosService, InvalidFileError, NotFoundError } from './photos.service';

@Controller('photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  /**
   * POST /photos/avatar
   * Sube un avatar para el usuario autenticado.
   * Reemplaza el avatar anterior si existe.
   */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ): Promise<{ avatar_url: string }> {
    const userId = req.user.id;

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      return await this.photosService.uploadAvatar(userId, file);
    } catch (error) {
      if (error instanceof InvalidFileError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * DELETE /photos/avatar
   * Elimina el avatar del usuario autenticado.
   */
  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAvatar(@Request() req: any): Promise<void> {
    const userId = req.user.id;
    await this.photosService.deleteAvatar(userId);
  }

  /**
   * GET /photos/my-photos
   * Obtiene todas las fotos del usuario (avatar + galería).
   */
  @Get('my-photos')
  @HttpCode(HttpStatus.OK)
  async getMyPhotos(@Request() req: any) {
    const userId = req.user.id;
    return await this.photosService.getUserPhotos(userId);
  }

  /**
   * POST /photos/gallery
   * Sube una foto de galería en una posición específica.
   */
  @Post('gallery')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadGalleryPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body('position') positionStr: string,
    @Request() req: any,
  ): Promise<{ id: string; public_url: string; position: number }> {
    const userId = req.user.id;

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!positionStr) {
      throw new BadRequestException('Position is required');
    }

    const position = parseInt(positionStr, 10);

    if (isNaN(position)) {
      throw new BadRequestException('Position must be a valid number');
    }

    try {
      return await this.photosService.uploadGalleryPhoto(userId, file, position);
    } catch (error) {
      if (error instanceof InvalidFileError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * PATCH /photos/gallery/reorder
   * Reordena las fotos de galería del usuario.
   */
  @Patch('gallery/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderGalleryPhotos(
    @Body() positions: Array<{ id: string; position: number }>,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    const userId = req.user.id;

    if (!Array.isArray(positions)) {
      throw new BadRequestException('Positions must be an array');
    }

    try {
      await this.photosService.reorderGalleryPhotos(userId, positions);
      return { success: true };
    } catch (error) {
      if (error instanceof InvalidFileError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof NotFoundError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * DELETE /photos/gallery/:photoId
   * Elimina una foto de galería del usuario autenticado.
   */
  @Delete('gallery/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGalleryPhoto(
    @Param('photoId') photoId: string,
    @Request() req: any,
  ): Promise<void> {
    const userId = req.user.id;

    try {
      await this.photosService.deleteGalleryPhoto(userId, photoId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * DELETE /photos/:userId
   * Admin: Elimina todas las fotos de un usuario.
   */
  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  async deleteUserPhotos(
    @Param('userId') userId: string,
    @Request() req: any,
  ): Promise<{ success: boolean; deleted_count: number }> {
    const adminId = req.user.id;

    // TODO: Verificar que el usuario es admin
    // Por ahora, permitir que cualquiera lo intente (debería validarse)

    // Contar fotos antes de eliminar (para la respuesta)
    const userPhotos = await this.photosService.getUserPhotos(userId);
    const deletedCount = (userPhotos.gallery?.length || 0) + (userPhotos.avatar_url ? 1 : 0);

    await this.photosService.deleteUserPhotos(userId, adminId);

    return { success: true, deleted_count: deletedCount };
  }
}
