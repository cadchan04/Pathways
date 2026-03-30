import { useState, useEffect } from 'react';
import { subscribeToPush, unsubscribeFromPush } from '../hooks/usePushNotifications';

export default function NotificationToggle({ userId }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize enabled state based on user's DB value and push subscription
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/user/${userId}`);
        const userData = await res.json();

        // If pushSubscription is missing, force notifications off
        if (!userData.pushSubscription) {
          setEnabled(false);
        } else {
          setEnabled(!!userData.notificationEnabled);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch user notification status:', err);
        setLoading(false);
      }
    };

    fetchStatus();
  }, [userId]);

  const toggle = async () => {
    setLoading(true);

    try {
      if (enabled) {
        // Turn off notifications
        await unsubscribeFromPush(userId);
        setEnabled(false);
      } else {
        // Turn on notifications
        const sub = await subscribeToPush(userId);
        if (sub) {
          setEnabled(true);
        }
      }
    } catch (err) {
      console.error('Failed to toggle notifications:', err);
    }

    setLoading(false);
  };

  if (loading) return null;

  return (
    <button onClick={toggle}>
      {enabled ? 'On: 🔔' : 'Off: 🔕'}
    </button>
  );
}