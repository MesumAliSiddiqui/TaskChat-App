import { enableScreens } from 'react-native-screens';
enableScreens();
import Config from 'react-native-config';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: Config.GOOGLE_WEB_CLIENT_ID,
});
console.log('GOOGLE CLIENT ID:', Config.GOOGLE_WEB_CLIENT_ID);

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { CallProvider } from './src/context/CallContext';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <CallProvider>
            <AppNavigator />
          </CallProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;