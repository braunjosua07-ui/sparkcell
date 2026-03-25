/**
 * SendEmailTool — Send email via SMTP.
 *
 * SMTP config comes from context.smtpConfig (set in startup.json).
 * Uses raw SMTP over net/tls sockets — no external dependencies.
 * Permission: ask (once, then persistent).
 */
import net from 'node:net';
import tls from 'node:tls';

export default class SendEmailTool {
  name = 'sendEmail';
  description = 'Send an email via SMTP. Requires SMTP configuration in startup.json (smtp.host, smtp.port, smtp.user, smtp.pass, smtp.from).';
  parameters = {
    to: { type: 'string', required: true, description: 'Recipient email address' },
    subject: { type: 'string', required: true, description: 'Email subject' },
    body: { type: 'string', required: true, description: 'Email body (plain text)' },
  };
  permissionLevel = 'ask';

  async execute(args, context) {
    const { to, subject, body } = args;

    const smtp = context.smtpConfig;
    if (!smtp || !smtp.host) {
      return { success: false, output: null, error: 'SMTP not configured. Add smtp config to startup.json (host, port, user, pass, from).' };
    }

    // Basic email validation
    if (!to.includes('@')) {
      return { success: false, output: null, error: `Invalid email address: "${to}"` };
    }

    try {
      await sendSMTP({
        host: smtp.host,
        port: smtp.port || 587,
        secure: smtp.secure ?? (smtp.port === 465),
        user: smtp.user,
        pass: smtp.pass,
        from: smtp.from || smtp.user,
        to,
        subject,
        body,
      });

      if (context.bus) {
        context.bus.publish('comm:email-sent', {
          agentId: context.agentId,
          agentName: context.agentName,
          to,
          subject,
        });
      }

      return { success: true, output: `Email sent to ${to}: "${subject}"` };
    } catch (err) {
      return { success: false, output: null, error: `SMTP error: ${err.message}` };
    }
  }
}

/**
 * Minimal SMTP client — sends a single email.
 * Supports STARTTLS (port 587) and direct TLS (port 465).
 */
function sendSMTP({ host, port, secure, user, pass, from, to, subject, body }) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('SMTP timeout')), 30000);

    const commands = [
      `EHLO sparkcell`,
      ...(user && pass ? [`AUTH LOGIN`, Buffer.from(user).toString('base64'), Buffer.from(pass).toString('base64')] : []),
      `MAIL FROM:<${from}>`,
      `RCPT TO:<${to}>`,
      `DATA`,
      [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `Date: ${new Date().toUTCString()}`,
        `Content-Type: text/plain; charset=utf-8`,
        `X-Mailer: SparkCell/1.0`,
        ``,
        body,
        `.`,
      ].join('\r\n'),
      `QUIT`,
    ];

    let cmdIndex = 0;
    let dataMode = false;

    function createConnection() {
      if (secure) {
        return tls.connect(port, host, { rejectUnauthorized: false });
      }
      return net.connect(port, host);
    }

    const socket = createConnection();
    socket.setEncoding('utf8');

    socket.on('data', (data) => {
      const code = parseInt(data.slice(0, 3));

      if (code >= 400) {
        clearTimeout(timeout);
        socket.end();
        reject(new Error(`SMTP ${code}: ${data.trim()}`));
        return;
      }

      // After greeting or successful response, send next command
      if (cmdIndex < commands.length) {
        const cmd = commands[cmdIndex++];
        socket.write(cmd + '\r\n');
      } else {
        clearTimeout(timeout);
        socket.end();
        resolve();
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

export { sendSMTP };
