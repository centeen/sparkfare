import webpush from 'web-push';

export async function sendWebPush(env, subscription, payload) {
  // Use VAPID keys from environment variables
  const vapidPublicKey = env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
  
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("Missing VAPID keys. Web push aborted.");
    return false;
  }
  
  webpush.setVapidDetails(
    'mailto:hello@sparkfare.com',
    vapidPublicKey,
    vapidPrivateKey
  );

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('Failed to send web push:', err);
    if (err.statusCode === 410 || err.statusCode === 404) {
      // The subscription is no longer valid, we should remove it from the DB
      try {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
          .bind(subscription.endpoint)
          .run();
        console.log(`Deleted stale push subscription: ${subscription.endpoint}`);
      } catch (dbErr) {
        console.error('Failed to delete stale push subscription:', dbErr);
      }
    }
    return false;
  }
}
