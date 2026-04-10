import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const to = body?.to as string | undefined;
    const name = (body?.name as string | undefined) || 'there';
    const message = (body?.message as string | undefined) || `Welcome to GLYVORA, ${name}! Your account is ready and your wellness journey has started.`;

    if (!to) {
      return NextResponse.json({ error: 'Missing phone number' }, { status: 400 });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json({ error: 'Twilio environment variables are missing' }, { status: 500 });
    }

    const payload = new URLSearchParams();
    payload.set('To', to);
    payload.set('From', fromNumber);
    payload.set('Body', message);

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, sid: data.sid });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to send SMS' }, { status: 500 });
  }
}
