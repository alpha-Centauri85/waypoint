import { notifications } from '@mantine/notifications';

// Surface a failed action to the user instead of failing silently. Pass the
// error from a rejected api call; the message comes from the server when present.
export function notifyError(err, title = 'Something went wrong') {
  notifications.show({
    color: 'red',
    title,
    message: err?.message || 'Please try again.',
  });
}
