import nodemailer from 'nodemailer';

export function createMail(config) {
  const transport = nodemailer.createTransport(config.smtp);
  return {
    // The auth service invokes this only after an allowed login/enrollment action.
    // Verification codes are never logged, returned to the browser or persisted in plaintext.
    async sendCode(input) {
      const email = input.email || input.to;
      const code = input.code;
      if (typeof email !== 'string' || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || !/^\d{6}$/.test(code)) throw new Error('Invalid verification message');
      await transport.sendMail({
        from: { name: 'NorthWallEg', address: config.smtpFrom },
        to: [{ address: email }],
        subject: 'Your NorthWallEg verification code',
        text: `Your NorthWallEg verification code is ${code}.\n\nIt expires in five minutes and can be used once. Do not share this code. NorthWallEg staff will never ask you to send it to them.\n\nIf you did not request this, you can ignore this email.`,
        disableFileAccess: true, disableUrlAccess: true,
      });
    },
    async sendPasswordReset({to,url,expiresInMinutes=15}) {
      if(typeof to!=='string'||!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to)) throw new Error('Invalid reset recipient');
      const target=new URL(url);
      if(target.origin!==config.origin||target.pathname!=='/reset-password'||!target.searchParams.has('token')||target.searchParams.size!==1) throw new Error('Invalid reset destination');
      await transport.sendMail({
        from:{name:'NorthWallEg',address:config.smtpFrom},to:[{address:to}],
        subject:'Reset your NorthWallEg workspace password',
        text:`A password reset was requested for your NorthWallEg account.\n\nUse this secure link within ${expiresInMinutes} minutes:\n${url}\n\nIf you did not request this, ignore this email. Your password has not changed. Never share this link.`,
        disableFileAccess:true,disableUrlAccess:true,
      });
    },
    close() { transport.close(); },
  };
}
