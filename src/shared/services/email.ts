import "server-only";
import { Resend } from "resend";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada");
  }
  return new Resend(apiKey);
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: "Printz <onboarding@resend.dev>",
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail: ${error.message}`);
  }
}
