import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, title, messageBody, data } = body;

    if (!to) {
      return NextResponse.json({ success: false, error: 'Recipient token missing' }, { status: 400 });
    }

    const payload = Array.isArray(to) 
      ? to.map(t => ({ to: t, title, body: messageBody, data }))
      : { to, title, body: messageBody, data };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resData = await res.json();
    return NextResponse.json({ success: true, data: resData });
  } catch (error: any) {
    console.error('Notification dispatch server error:', error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
