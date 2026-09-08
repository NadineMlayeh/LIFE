import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ProfilesService } from './profiles.service.js';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  get(@CurrentUser() user: RequestUser) {
    return this.profiles.get(user.id);
  }

  @Put()
  update(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.upsert(user.id, dto);
  }

}
