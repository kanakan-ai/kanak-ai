import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SmsDeliveryError } from '../types.js';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-sns', () => {
  class PublishCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class SNSClient {
    send(command: PublishCommand) {
      return sendMock(command);
    }
  }
  return { SNSClient, PublishCommand };
});

const { createSnsSmsProvider } = await import('../sns-provider.js');

describe('createSnsSmsProvider', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ MessageId: 'test-message-id' });
  });

  test('sends a transactional SMS to the E.164 destination', async () => {
    const provider = createSnsSmsProvider();
    await provider.send({ to: '+15551234567', body: 'Code: 123456' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input).toMatchObject({
      PhoneNumber: '+15551234567',
      Message: 'Code: 123456',
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
      },
    });
  });

  test('propagates unrecognized SNS errors unchanged', async () => {
    sendMock.mockRejectedValueOnce(new Error('Some other AWS problem'));
    const provider = createSnsSmsProvider();

    await expect(provider.send({ to: '+15551234567', body: 'x' })).rejects.toThrow('Some other AWS problem');
  });

  test.each(['AuthorizationErrorException', 'OptedOutException'])(
    'wraps SNS %s as a recipient_rejected SmsDeliveryError',
    async (errorName) => {
      const snsError = new Error('not authorized / opted out');
      snsError.name = errorName;
      sendMock.mockRejectedValueOnce(snsError);
      const provider = createSnsSmsProvider();

      const rejection = provider.send({ to: '+15551234567', body: 'x' });

      await expect(rejection).rejects.toBeInstanceOf(SmsDeliveryError);
      await expect(rejection).rejects.toMatchObject({ reason: 'recipient_rejected' });
    }
  );

  test.each(['ExpiredToken', 'InvalidClientTokenId', 'UnrecognizedClientException', 'SignatureDoesNotMatch'])(
    'wraps SNS %s as a credentials_invalid SmsDeliveryError',
    async (errorName) => {
      const snsError = new Error('bad credentials');
      snsError.name = errorName;
      sendMock.mockRejectedValueOnce(snsError);
      const provider = createSnsSmsProvider();

      const rejection = provider.send({ to: '+15551234567', body: 'x' });

      await expect(rejection).rejects.toBeInstanceOf(SmsDeliveryError);
      await expect(rejection).rejects.toMatchObject({ reason: 'credentials_invalid' });
    }
  );

  test('has a stable provider id', () => {
    expect(createSnsSmsProvider().id).toBe('sns');
  });
});
