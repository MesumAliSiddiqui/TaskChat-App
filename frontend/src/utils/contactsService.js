import { Platform, PermissionsAndroid } from 'react-native';
import Contacts from 'react-native-contacts';
import api from '../api/client';

// Strips everything except digits and a leading +, so numbers saved in
// wildly different formats in the phone's address book (spaces, dashes,
// parentheses) can still be matched against the backend's stored phone field.
const normalizePhone = (raw) => {
  if (!raw) return '';
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/[^\d]/g, '');
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
};

// Requests the READ_CONTACTS permission on Android. iOS handles its
// permission prompt automatically the first time Contacts.getAll() is called,
// driven by the NSContactsUsageDescription in Info.plist.
export const requestContactsPermission = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      {
        title: 'Contacts Permission',
        message: 'TaskChat needs access to your contacts to show saved names for people you chat with.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Contacts permission error:', err);
    return false;
  }
};

// Reads every phone number from the device's address book, building a map
// of normalizedPhoneNumber -> the name saved for it locally. If the same
// number appears under multiple contacts, the first one found wins.
const buildDeviceContactMap = async () => {
  const deviceContacts = await Contacts.getAll();
  const map = {};
  for (const contact of deviceContacts) {
    const displayName = contact.displayName || `${contact.givenName || ''} ${contact.familyName || ''}`.trim();
    for (const phoneEntry of contact.phoneNumbers || []) {
      const normalized = normalizePhone(phoneEntry.number);
      if (normalized && !map[normalized]) {
        map[normalized] = displayName || normalized;
      }
    }
  }
  return map;
};

// Main entry point: reads device contacts, sends their numbers to the
// backend to find which ones are registered TaskChat users, and returns
// each match enriched with the locally-saved contact name (WhatsApp-style -
// if you haven't saved someone's number, you'll only see their raw number
// even though they have an account).
export const getMatchedContacts = async () => {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) {
    return { matches: [], permissionDenied: true };
  }

  const deviceContactMap = await buildDeviceContactMap();
  const allDevicePhones = Object.keys(deviceContactMap);

  if (allDevicePhones.length === 0) {
    return { matches: [], permissionDenied: false };
  }

  const { data: registeredUsers } = await api.post('/users/lookup', { phones: allDevicePhones });

  const matches = registeredUsers.map((user) => {
    const normalized = normalizePhone(user.phone);
    const savedName = deviceContactMap[normalized];
    return {
      ...user,
      // WhatsApp behavior: show the name YOU saved them as, not their
      // app profile name, and fall back to the raw number if unsaved.
      displayName: savedName || user.phone,
      isSavedContact: !!savedName,
    };
  });

  return { matches, permissionDenied: false };
};

export { normalizePhone };