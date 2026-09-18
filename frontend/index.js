/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import RNCallKeep from 'react-native-callkeep';
import notifee, { EventType } from '@notifee/react-native';

// // const options = {
// //   ios: {
// //     appName: 'TaskChat',
// //   },
// //   android: {
// //     alertTitle: 'Permissions required',
// //     alertDescription: 'This application needs to access your phone accounts',
// //     cancelButton: 'Cancel',
// //     okButton: 'ok',
// //     imageName: 'phone_account_icon',
// //   }
// // };

// RNCallKeep.setup(options).then(accepted => { });

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    // Handle routing logic based on detail.notification.data.type
    // Deep linking will trigger via initial notification on launch
  }
});

AppRegistry.registerComponent(appName, () => App);
