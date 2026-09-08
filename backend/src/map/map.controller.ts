import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpsertVisitedCountryDto } from './dto/visited-country.dto.js';
import { MapService } from './map.service.js';

@Controller('map/countries')
@UseGuards(JwtAuthGuard)
export class MapController {
  constructor(private readonly map: MapService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.map.list(user.id);
  }

  @Put()
  upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertVisitedCountryDto) {
    return this.map.upsert(user.id, dto);
  }

  @Delete(':countryCode')
  remove(@CurrentUser() user: RequestUser, @Param('countryCode') countryCode: string) {
    return this.map.remove(user.id, countryCode);
  }
}
