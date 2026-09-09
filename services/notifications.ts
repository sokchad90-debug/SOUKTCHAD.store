import * as Notifications from 'expo-notifications';

export async function initializeNotifications(): Promise<boolean> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function sendLocalNotification(title: string, body: string, data?: Record<string, any>) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data || {}, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.log('Notification error:', e);
  }
}

export async function sendOrderNotification(
  type: 'new_order' | 'order_confirmed' | 'order_completed' | 'order_shipped',
  productTitle: string,
  lang: string = 'en',
) {
  const msgs: Record<string, { title: Record<string, string>; body: Record<string, string> }> = {
    new_order: {
      title: { en: 'New Order Received!', fr: 'Nouvelle commande!', ar: 'طلب جديد!' },
      body: {
        en: `Someone ordered "${productTitle}". Check your orders.`,
        fr: `Quelqu un a commande "${productTitle}". Verifiez vos commandes.`,
        ar: `طلب شخص ما "${productTitle}". تحقق من طلباتك.`,
      },
    },
    order_confirmed: {
      title: { en: 'Order Confirmed!', fr: 'Commande confirmee!', ar: 'تم تأكيد الطلب!' },
      body: {
        en: `Your order for "${productTitle}" has been confirmed.`,
        fr: `Votre commande pour "${productTitle}" a ete confirmee.`,
        ar: `تم تأكيد طلبك لـ "${productTitle}".`,
      },
    },
    order_completed: {
      title: { en: 'Order Completed!', fr: 'Commande terminee!', ar: 'تم إكمال الطلب!' },
      body: {
        en: `Your order for "${productTitle}" is complete!`,
        fr: `Votre commande pour "${productTitle}" est terminee!`,
        ar: `تم إكمال طلبك لـ "${productTitle}"!`,
      },
    },
    order_shipped: {
      title: { en: 'Order Shipping!', fr: 'Commande expediee!', ar: 'جاري شحن الطلب!' },
      body: {
        en: `"${productTitle}" is being shipped to you.`,
        fr: `"${productTitle}" est en cours d expedition.`,
        ar: `جاري شحن "${productTitle}" إليك.`,
      },
    },
  };
  const m = msgs[type];
  if (!m) return;
  await sendLocalNotification(m.title[lang] || m.title.en, m.body[lang] || m.body.en, { type: 'order', screen: 'profile' });
}

export async function sendMessageNotification(senderName: string, preview: string, lang: string = 'en') {
  const titles: Record<string, string> = {
    en: `New message from ${senderName}`,
    fr: `Nouveau message de ${senderName}`,
    ar: `رسالة جديدة من ${senderName}`,
  };
  const body = preview.length > 60 ? preview.slice(0, 60) + '...' : preview;
  await sendLocalNotification(titles[lang] || titles.en, body, { type: 'message', screen: 'chats' });
}

export async function sendVerificationNotification(status: 'approved' | 'rejected', lang: string = 'en') {
  if (status === 'approved') {
    const titles: Record<string, string> = {
      en: 'Verification Approved!', fr: 'Verification approuvee!', ar: 'تم الموافقة على التوثيق!',
    };
    const bodies: Record<string, string> = {
      en: 'Your Blue Badge is now active!',
      fr: 'Votre Badge Bleu est maintenant actif!',
      ar: 'شارتك الزرقاء مفعلة الآن!',
    };
    await sendLocalNotification(titles[lang] || titles.en, bodies[lang] || bodies.en, { type: 'verification', screen: 'profile' });
  } else {
    const titles: Record<string, string> = {
      en: 'Verification Update', fr: 'Mise a jour de verification', ar: 'تحديث التوثيق',
    };
    const bodies: Record<string, string> = {
      en: 'Your request was not approved. You can re-apply.',
      fr: 'Votre demande n a pas ete approuvee. Refaites la demande.',
      ar: 'لم تتم الموافقة على طلبك. يمكنك إعادة التقديم.',
    };
    await sendLocalNotification(titles[lang] || titles.en, bodies[lang] || bodies.en, { type: 'verification', screen: 'profile' });
  }
}

export async function updateAppBadge(count: number) {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch (_e) {
    // Badge not supported on all platforms
  }
}
