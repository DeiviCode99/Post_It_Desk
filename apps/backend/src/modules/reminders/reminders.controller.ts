import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { RemindersService } from './reminders.service';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get('due')
  findDue() {
    return this.remindersService.findDue();
  }

  @Post(':id/ack')
  @HttpCode(204)
  acknowledge(@Param('id', ParseUUIDPipe) id: string) {
    return this.remindersService.acknowledge(id);
  }
}
