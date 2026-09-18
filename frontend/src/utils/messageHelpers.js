import { Linking, Alert } from 'react-native';
import { BASE_URL } from '../api/client';

export const getQuotedReply = (item) => {
  if (typeof item.text === 'string' && item.text.startsWith('ðŸ’¬ [Reply to ')) {
    const match = item.text.match(/^ðŸ’¬ \[Reply to (.*?): "(.*?)"\]\n([\s\S]*)$/);
    if (match) {
      return {
        senderName: match[1],
        text: match[2],
        cleanText: match[3],
      };
    }
  }
  return null;
};

export const getImageSource = (item) => {
  const raw = item.image || item.attachmentUrl;
  if (!raw || typeof raw !== 'string') return null;
  
  if (raw.startsWith('http') || raw.startsWith('file://') || raw.startsWith('data:')) {
    return { uri: raw };
  }
  return { uri: `${BASE_URL}${raw}` };
};

export const openLocationLink = (text) => {
  const urlMatch = text.match(/https:\/\/maps\.app\.goo\.gl\/[a-zA-Z0-9]+/);
  if (urlMatch) {
    Linking.openURL(urlMatch[0]).catch(() => {
      Alert.alert('Error', 'Could not open map link');
    });
  }
};
