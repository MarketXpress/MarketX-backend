import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute } from './entities/dispute.entity';
import { Evidence } from './evidence.entity';
import { MessagesService } from '../messages/messages.service';

// Replace with your LLM API integration
async function callLLM(payload: {
  complaint: string;
  response: string;
  chatLogs: string;
  tos: string;
}): Promise<{ summary: string; recommendation: string }> {
  // TODO: Integrate with OpenAI, Azure, or your LLM provider
  return {
    summary: 'Sample summary',
    recommendation: 'Sample recommendation',
  };
}

@Injectable()
export class DisputeAiWorker {
  private readonly logger = new Logger(DisputeAiWorker.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    @InjectRepository(Evidence)
    private readonly evidenceRepo: Repository<Evidence>,
    private readonly messagesService: MessagesService,
  ) {}

  async processDispute(disputeId: string, tos: string) {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) throw new Error('Dispute not found');

    // Gather evidence
    const evidences = await this.evidenceRepo.find({ where: { disputeId } });
    const evidenceText = evidences.map(e => `${e.submittedBy}: ${e.description || ''} (${e.fileUrl})`).join('\n');

    // Gather chat logs
    const messages = await this.messagesService.getMessagesByOrderId(dispute.orderId, dispute.buyerId);
    const chatLogs = messages.map(m => `${m.senderId}: ${m.content}`).join('\n');

    // Compose payload
    const payload = {
      complaint: dispute.description,
      response: '', // TODO: Add seller response if available
      chatLogs,
      tos,
    };

    // Call LLM
    const { summary, recommendation } = await callLLM(payload);

    // Store results
    dispute.aiSummary = summary;
    dispute.aiRecommendation = recommendation;
    await this.disputeRepo.save(dispute);
    this.logger.log(`AI recommendation stored for dispute ${disputeId}`);
  }
}
