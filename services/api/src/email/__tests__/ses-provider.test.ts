import { describe, test, expect, vi, beforeEach } from 'vitest';
import { EmailDeliveryError } from '../types.js';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-ses', () => {
  class SendEmailCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class SESClient {
    send(command: SendEmailCommand) {
      return sendMock(command);
    }
  }
  return { SESClient, SendEmailCommand };
});

const { createSesEmailProvider } = await import('../ses-provider.js');

describe('createSesEmailProvider', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ MessageId: 'test-message-id' });
  });

  test('sends a text-only message with the configured from address', async () => {
    const provider = createSesEmailProvider('kanak@example.com');
    await provider.send({ to: 'user@example.com', subject: 'Your code', text: 'Code: 123456' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.input).toMatchObject({
      Source: 'kanak@example.com',
      Destination: { ToAddresses: ['user@example.com'] },
      Message: {
        Subject: { Data: 'Your code', Charset: 'UTF-8' },
        Body: { Text: { Data: 'Code: 123456', Charset: 'UTF-8' } },
      },
    });
    expect(command.input.Message.Body.Html).toBeUndefined();
  });

  test('includes an HTML body when provided', async () => {
    const provider = createSesEmailProvider('kanak@example.com');
    await provider.send({
      to: 'user@example.com',
      subject: 'Your code',
      text: 'Code: 123456',
      html: '<p>Code: 123456</p>',
    });

    const command = sendMock.mock.calls[0][0];
    expect(command.input.Message.Body.Html).toEqual({ Data: '<p>Code: 123456</p>', Charset: 'UTF-8' });
  });

  test('propagates unrecognized SES errors unchanged', async () => {
    sendMock.mockRejectedValueOnce(new Error('Some other AWS problem'));
    const provider = createSesEmailProvider('kanak@example.com');

    await expect(
      provider.send({ to: 'user@example.com', subject: 'x', text: 'x' })
    ).rejects.toThrow('Some other AWS problem');
  });

  test.each(['AccessDenied', 'MessageRejected'])(
    'wraps SES %s as a recipient_rejected EmailDeliveryError',
    async (errorName) => {
      const sesError = new Error('not authorized / not verified');
      sesError.name = errorName;
      sendMock.mockRejectedValueOnce(sesError);
      const provider = createSesEmailProvider('kanak@example.com');

      const rejection = provider.send({ to: 'unverified@example.com', subject: 'x', text: 'x' });

      await expect(rejection).rejects.toBeInstanceOf(EmailDeliveryError);
      await expect(rejection).rejects.toMatchObject({ reason: 'recipient_rejected' });
    }
  );

  test.each(['ExpiredToken', 'InvalidClientTokenId', 'UnrecognizedClientException', 'SignatureDoesNotMatch'])(
    'wraps SES %s as a credentials_invalid EmailDeliveryError',
    async (errorName) => {
      const sesError = new Error('bad credentials');
      sesError.name = errorName;
      sendMock.mockRejectedValueOnce(sesError);
      const provider = createSesEmailProvider('kanak@example.com');

      const rejection = provider.send({ to: 'user@example.com', subject: 'x', text: 'x' });

      await expect(rejection).rejects.toBeInstanceOf(EmailDeliveryError);
      await expect(rejection).rejects.toMatchObject({ reason: 'credentials_invalid' });
    }
  );

  test('has a stable provider id', () => {
    expect(createSesEmailProvider('kanak@example.com').id).toBe('ses');
  });
});
