import {
  sanitizeGatewayUrl,
  buildGatewayHeaders,
  parseNestJsError,
} from '@/lib/openwa-client';

describe('OpenWA Client & Helper Utilities', () => {
  it('should sanitize gateway base URL cleanly', () => {
    expect(sanitizeGatewayUrl('http://localhost:2785')).toBe('http://localhost:2785/api');
    expect(sanitizeGatewayUrl('http://localhost:2785/')).toBe('http://localhost:2785/api');
    expect(sanitizeGatewayUrl('http://192.168.1.50:2785/api')).toBe('http://192.168.1.50:2785/api');
  });

  it('should attach X-API-Key header and NEVER use query parameters', () => {
    const headers = buildGatewayHeaders('secret_test_key_123');
    expect(headers['X-API-Key']).toBe('secret_test_key_123');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should format NestJS error response shapes properly', () => {
    const singleMsgErr = {
      response: {
        status: 400,
        data: {
          statusCode: 400,
          message: 'phoneNumber must be digits only in international format',
          error: 'Bad Request',
        },
      },
    };
    expect(parseNestJsError(singleMsgErr)).toBe(
      'phoneNumber must be digits only in international format'
    );

    const arrayMsgErr = {
      response: {
        status: 400,
        data: {
          statusCode: 400,
          message: [
            'name can only contain letters, numbers, and hyphens',
            'name must be longer than 3 characters',
          ],
          error: 'Bad Request',
        },
      },
    };
    expect(parseNestJsError(arrayMsgErr)).toContain(
      'name can only contain letters, numbers, and hyphens'
    );
    expect(parseNestJsError(arrayMsgErr)).toContain('name must be longer than 3 characters');
  });
});
