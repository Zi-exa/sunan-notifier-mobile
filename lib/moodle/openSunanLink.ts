import * as Linking from 'expo-linking';
import { resolveMoodleAutologinUrl } from '@/lib/moodle/client';

type OpenSunanLinkOptions = {
  url?: string | null;
  token?: string | null;
  userId?: number | null;
  privateToken?: string | null;
};

export async function openSunanLink({
  url,
  token,
  userId,
  privateToken,
}: OpenSunanLinkOptions): Promise<void> {
  if (!url) {
    return;
  }

  let urlToOpen = url;

  if (token && userId) {
    const autologinUrl = await resolveMoodleAutologinUrl(token, userId, url, privateToken);
    if (autologinUrl) {
      urlToOpen = autologinUrl;
    }
  }

  await Linking.openURL(urlToOpen);
}
