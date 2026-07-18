import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Configure VAPID details for Web Push
webpush.setVapidDetails(
  'mailto:support@suyog.net',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, title, messageBody, data } = body;

    if (!to) {
      return NextResponse.json({ success: false, error: 'Recipient token missing' }, { status: 400 });
    }

    // Helper to send a single Web Push notification
    const sendWebPush = async (subscription: any) => {
      return webpush.sendNotification(
        subscription,
        JSON.stringify({
          title,
          body: messageBody,
          data,
        })
      );
    };

    // Helper to check if a token string represents a JSON Web Push subscription
    const isWebPushSubscription = (token: any) => {
      if (typeof token === 'object' && token?.endpoint) return true;
      if (typeof token === 'string' && token.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(token);
          if (parsed && parsed.endpoint) return true;
        } catch (e) {}
      }
      return false;
    };

    const parseSubscription = (token: any) => {
      if (typeof token === 'object') return token;
      return JSON.parse(token);
    };

    // Handle array of recipients (for broadcast)
    if (Array.isArray(to)) {
      const webPushPromises: any[] = [];
      const expoTokens: string[] = [];

      for (const recipient of to) {
        if (isWebPushSubscription(recipient)) {
          webPushPromises.push(
            sendWebPush(parseSubscription(recipient)).catch(err =>
              console.error('Web push failed:', err)
            )
          );
        } else {
          expoTokens.push(recipient);
        }
      }

      // Send Expo push notifications
      if (expoTokens.length > 0) {
        const expoPayload = expoTokens.map(token => ({
          to: token,
          title,
          body: messageBody,
          data,
        }));
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expoPayload),
        });
      }

      // Wait for all Web Push deliveries
      if (webPushPromises.length > 0) {
        await Promise.all(webPushPromises);
      }

      return NextResponse.json({ success: true, message: 'Broadcast complete' });
    }

    // Handle single recipient
    if (isWebPushSubscription(to)) {
      await sendWebPush(parseSubscription(to));
      return NextResponse.json({ success: true, type: 'web_push' });
    } else {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          title,
          body: messageBody,
          data,
        }),
      });
      const resData = await res.json();
      return NextResponse.json({ success: true, type: 'expo_push', data: resData });
    }
  } catch (error: any) {
    console.error('Notification dispatch server error:', error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
