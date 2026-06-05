/**
 * Notification Service
 * Handles sending notifications for approval workflows
 */

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendApprovalNotification(
    userId: string,
    decisionId: string,
    reason: string
  ): Promise<void> {
    this.logger.log(
      `Approval notification sent to ${userId} for decision ${decisionId}: ${reason}`
    );
  }

  async sendDecisionNotification(
    userId: string,
    decision: { id: string; status: string }
  ): Promise<void> {
    this.logger.log(`Decision notification sent to ${userId}: ${decision.id} - ${decision.status}`);
  }

  async sendAnomalyAlert(userId: string, anomalyType: string, severity: string): Promise<void> {
    this.logger.warn(`Anomaly alert for ${userId}: ${anomalyType} (${severity})`);
  }
}
