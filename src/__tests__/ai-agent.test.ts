import { WhatsAppAiAgent } from '../domain/whatsapp/ai-agent';

describe('WhatsAppAiAgent', () => {
  it('should fall back to default Egyptian Arabic reply when no LLM API keys are configured', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: '',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      OPENROUTER_API_KEY: '',
    };

    const decision = await WhatsAppAiAgent.evaluateTurn(
      [
        {
          direction: 'inbound',
          body: 'أهلاً، حابب أعرف أكتر عن خدماتكم للشركات',
          createdAt: new Date().toISOString(),
        },
      ],
      {
        contactPhone: '+201092314597',
        recipientName: 'Hassan',
      }
    );

    expect(decision).toBeDefined();
    expect(decision.action).toBe('REPLY');
    expect(decision.replyText).toBeDefined();
    expect(decision.replyText?.length).toBeGreaterThan(5);

    process.env = originalEnv;
  });

  it('should detect brochure request intent in Egyptian Arabic', async () => {
    const decision = await WhatsAppAiAgent.evaluateTurn(
      [
        {
          direction: 'inbound',
          body: 'ممكن تبعتلي الملف التعريفي البروفايل PDF للشركة؟',
          createdAt: new Date().toISOString(),
        },
      ],
      {
        contactPhone: '+201092314597',
        recipientName: 'Ahmed',
      }
    );

    expect(decision.action).toBe('REPLY');
    expect(decision.sendBrochure).toBe(true);
  });
});
