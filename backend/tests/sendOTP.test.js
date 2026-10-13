describe('sendOTP transporter (regression test for the indefinite-hang bug)', () => {
  test('the SMTP transporter is configured with bounded timeouts', () => {
    // Constructing the module doesn't make any network call — nodemailer
    // only connects on sendMail()/verify() — so this is safe to check
    // without mocking anything.
    jest.resetModules();
    const nodemailer = require('nodemailer');
    const originalCreateTransport = nodemailer.createTransport;
    let capturedOptions = null;
    nodemailer.createTransport = (options) => {
      capturedOptions = options;
      return originalCreateTransport(options);
    };

    require('../utils/sendOTP');

    expect(capturedOptions).not.toBeNull();
    // Before the fix, none of these were set, and a genuinely
    // unreachable/misconfigured SMTP target (verified live against this
    // sandbox's network) caused sendMail() — and therefore the whole
    // /auth/request-otp or message-send HTTP request — to hang
    // indefinitely instead of failing with a catchable error.
    expect(capturedOptions.connectionTimeout).toBeGreaterThan(0);
    expect(capturedOptions.greetingTimeout).toBeGreaterThan(0);
    expect(capturedOptions.socketTimeout).toBeGreaterThan(0);

    nodemailer.createTransport = originalCreateTransport;
  });
});
