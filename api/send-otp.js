import { Resend } from "resend";

export default async function handler(REQ, RES) {
  RES.setHeader("Access-Control-Allow-Origin", "*");
  RES.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  RES.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (REQ.method === "OPTIONS") {
    return RES.status(200).end();
  }

  if (REQ.method !== "POST") {
    return RES.status(405).json({ error: "Method not allowed" });
  }

  const { email, otp } = REQ.body;

  if (!email || !otp) {
    return RES.status(400).json({ error: "Email and OTP are required" });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_KEY) {
    return RES.status(500).json({ error: "RESEND_API_KEY environment variable is missing" });
  }

  try {
    const RESEND = new Resend(RESEND_KEY);

    await RESEND.emails.send({
      from: "Machine Intelligence School <onboarding@machineintelligenceschool.com>",
      to: [email],
      subject: "Your Access OTP Code",
      html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`
    });

    return RES.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (ERR) {
    console.error("Error sending OTP:", ERR);
    return RES.status(500).json({ error: ERR.message || "Failed to send OTP email" });
  }
}