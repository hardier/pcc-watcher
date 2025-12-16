export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notification");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const sendNotification = (title: string, body: string, url?: string) => {
  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      body: body,
      icon: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png', // Generic ticket icon
    });

    if (url) {
      notification.onclick = (event) => {
        event.preventDefault();
        window.open(url, '_blank');
      };
    }
  }
};