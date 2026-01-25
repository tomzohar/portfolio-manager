import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ConversationService } from './services/conversation.service';
import { UpdateConversationConfigDto } from './dto/update-conversation-config.dto';
import { Conversation } from './entities/conversation.entity';

@ApiTags('conversations')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get(':threadId')
  @ApiOperation({
    summary: 'Get conversation details including configuration',
  })
  @ApiParam({
    name: 'threadId',
    description: 'Thread identifier',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation details',
    type: Conversation,
  })
  async getConversation(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
  ): Promise<Conversation> {
    return this.conversationService.getConversation(threadId, user.id);
  }

  @Patch(':threadId/config')
  @ApiOperation({
    summary: 'Update conversation configuration',
  })
  @ApiParam({
    name: 'threadId',
    description: 'Thread identifier',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Update success',
    type: Boolean,
  })
  async updateConfiguration(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Body() config: UpdateConversationConfigDto,
  ): Promise<boolean> {
    return this.conversationService.updateConfiguration(
      threadId,
      user.id,
      config,
    );
  }
}
