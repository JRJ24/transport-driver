type MessagingModule = typeof import('@react-native-firebase/messaging');

async function loadMessaging(): Promise<MessagingModule | null> {
  return import('@react-native-firebase/messaging').catch(() => null);
}

void loadMessaging().then((messagingModule) => {
  if (!messagingModule) {
    return;
  }

  try {
    const messaging = messagingModule.getMessaging();
    messagingModule.setBackgroundMessageHandler(messaging, async () => {
      // Data is synced through REST/socket when the app is active; background FCM
      // only needs to acknowledge delivery so native resources can be released.
    });
  } catch {
    // Native Firebase is missing (Expo Go or a stale dev client): stay a no-op.
  }
});
