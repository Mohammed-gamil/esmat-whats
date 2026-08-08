import { processInboundWebhook } from '../application/whatsapp/process-inbound-webhook.use-case';

describe('processInboundWebhook', () => {
  it('should ignore non-message events gracefully', async () => {
    const payload = {
      event: 'session.status',
      session: 'sales-agent-1',
      payload: { status: 'WORKING' },
    };

    const result = await processInboundWebhook(payload);
    expect(result.success).toBe(true);
    expect(result.ignored).toBe(true);
  });
});
