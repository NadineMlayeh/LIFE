import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SetPrivacyDto, type PrivacyEntityType } from './dto/privacy.dto.js';
import { PrivacyService } from './privacy.service.js';

@Controller('privacy')
@UseGuards(JwtAuthGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  getMap(
    @CurrentUser() user: RequestUser,
    @Query('entityType') entityType: PrivacyEntityType,
    @Query('ids') ids?: string,
  ) {
    return this.privacy.getMap(user.id, entityType, ids ? ids.split(',').filter(Boolean) : []);
  }

  @Put()
  set(@CurrentUser() user: RequestUser, @Body() dto: SetPrivacyDto) {
    return this.privacy.set(user.id, dto.entityType, dto.entityId, dto.visibility);
  }
}
