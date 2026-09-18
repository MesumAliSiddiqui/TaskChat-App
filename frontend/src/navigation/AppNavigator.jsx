import React, { useEffect, useRef } from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { setupNotificationListeners } from '../services/pushNotificationService';
import { StackActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import AddPhoneScreen from '../screens/AddPhoneScreen';
import ChatListScreen from '../screens/ChatListScreen';
import NewChatScreen from '../screens/NewChatScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ContactDetailScreen from '../screens/ContactDetailScreen';
import AddMemberScreen from '../screens/AddMemberScreen';
import GroupMembersScreen from '../screens/GroupMembersScreen';
import TaskListScreen from '../screens/TaskListScreen';
import AssignTaskScreen from '../screens/AssignTaskScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SecurityScreen from '../screens/SecurityScreen';
import NotificationScreen from '../screens/NotificationScreen';
import ReminderBanner from '../components/ReminderBanner';
import PrivacyScreen from '../screens/PrivacyScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import AboutAppScreen from '../screens/AboutAppScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import CameraScreen from '../screens/CameraScreen';
import OutgoingCallScreen from '../screens/OutgoingCallScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';
import OngoingCallScreen from '../screens/OngoingCallScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';

import { colors } from '../theme/theme';

const icons = {
  chat: require('../assets/icons/chat.png'),
  task: require('../assets/icons/task.png'),
  profile: require('../assets/icons/profile.png'),
};

const TabIcon = ({ source, focused }) => (
  <View style={navStyles.iconContainer}>
    <Image
      source={source}
      style={[
        iconStyles.icon,
        {
          tintColor: focused ? colors.white : colors.gray,
        },
      ]}
      resizeMode="contain"
    />
  </View>
);

const iconStyles = StyleSheet.create({
  icon: { width: 22, height: 22 },
});

const AuthStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();
const TaskStack = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = ({ navigation }) => ({
  headerStyle: { backgroundColor: colors.darkBackground },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerLeft: ({ canGoBack }) =>
    canGoBack ? (
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={navStyles.headerBackBtn}
        activeOpacity={0.7}
      >
        <Image
          source={require('../assets/icons/back.png')}
          style={navStyles.headerBackIcon}
        />
      </TouchableOpacity>
    ) : undefined,
});

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={screenOptions}>
    <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    <AuthStack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign Up', headerBackTitleVisible: false }} />
    <AuthStack.Screen name="OTPVerification" component={OTPVerificationScreen} options={{ title: 'Verify', headerBackTitleVisible: false }} />
    <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
  </AuthStack.Navigator>
);

const AddPhoneNavigator = () => (
  <AuthStack.Navigator screenOptions={screenOptions}>
    <AuthStack.Screen
      name="AddPhone"
      component={AddPhoneScreen}
      options={{ headerShown: false }}
    />
  </AuthStack.Navigator>
);

const ChatNavigator = () => (
  <ChatStack.Navigator screenOptions={screenOptions}>
    <ChatStack.Screen name="ChatList" component={ChatListScreen} options={{ headerShown: false }} />
    <ChatStack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'New Chat', headerBackTitleVisible: false }} />
    <ChatStack.Screen name="ChatRoom" component={ChatRoomScreen} />
    <ChatStack.Screen name="CameraScreen" component={CameraScreen} options={{ headerShown: false }} />
    <ChatStack.Screen
      name="ContactDetail"
      component={ContactDetailScreen}
      options={{ headerShown: false }}
    />
    <ChatStack.Screen
      name="GroupMembers"
      component={GroupMembersScreen}
      options={{ headerShown: false }}
    />
    <ChatStack.Screen
      name="AddMember"
      component={AddMemberScreen}
      options={{ headerShown: false }}
    />
    <ChatStack.Screen
      name="LocationPicker"
      component={LocationPickerScreen}
      options={{ headerShown: false }}
    />
  </ChatStack.Navigator>
);

const TaskNavigator = () => (
  <TaskStack.Navigator screenOptions={screenOptions}>
    <TaskStack.Screen name="TaskList" component={TaskListScreen} options={{ headerShown: false }} />
    <TaskStack.Screen name="AssignTask" component={AssignTaskScreen} options={{ title: 'Assign Task', headerBackTitleVisible: false }} />
    <TaskStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ headerShown: false }} />
  </TaskStack.Navigator>
);

const ProfileStack = () => (
  <ProfileStackNav.Navigator screenOptions={screenOptions}>
    <ProfileStackNav.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
    <ProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile', headerBackTitleVisible: false }} />
    <ProfileStackNav.Screen name="Security" component={SecurityScreen} options={{ title: 'Security', headerBackTitleVisible: false }} />
    <ProfileStackNav.Screen name="Notifications" component={NotificationScreen} options={{ title: 'Notifications', headerBackTitleVisible: false }} />
    <ProfileStackNav.Screen name="Privacy" component={PrivacyScreen} options={{ headerShown: false }} />
    <ProfileStackNav.Screen name="HelpSupport" component={HelpSupportScreen} options={{ headerShown: false }} />
    <ProfileStackNav.Screen name="AboutApp" component={AboutAppScreen} options={{ headerShown: false }} />
    <ProfileStackNav.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerShown: false }} />
  </ProfileStackNav.Navigator>
);

const SCREENS_WITHOUT_TAB_BAR = [
  'ChatRoom',
  'EditProfile',
  'AssignTask',
  'NewChat',
  'ContactDetail',
  'Security',
  'TaskDetail',
  'Notifications',
  'AddMember',
  'GroupMembers',
  'Privacy',
  'HelpSupport',
  'AboutApp',
  'ChangePassword',
  'CameraScreen',
  'LocationPicker',
];

const getTabBarStyleForRoute = (route) => {
  const routeName = getFocusedRouteNameFromRoute(route) ?? '';
  if (SCREENS_WITHOUT_TAB_BAR.includes(routeName)) {
    return { display: 'none' };
  }
  return navStyles.bottomNavBar;
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.white,
      tabBarInactiveTintColor: colors.gray,
      tabBarStyle: getTabBarStyleForRoute(route),
      tabBarItemStyle: navStyles.tabBarItem,
      tabBarLabel: ({ focused, color }) => (
        <View style={navStyles.labelContainer}>
          <Text style={[navStyles.label, { color }]}>{route.name}</Text>
          {focused && <View style={navStyles.activeIndicator} />}
        </View>
      ),
    })}
  >
    <Tab.Screen
      name="Chats"
      component={ChatNavigator}
      options={{ tabBarIcon: ({ focused }) => <TabIcon source={icons.chat} focused={focused} /> }}
    />
    <Tab.Screen
      name="Tasks"
      component={TaskNavigator}
      options={{ tabBarIcon: ({ focused }) => <TabIcon source={icons.task} focused={focused} /> }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileStack}
      options={{ tabBarIcon: ({ focused }) => <TabIcon source={icons.profile} focused={focused} /> }}
    />
  </Tab.Navigator>
);

const MainStack = createNativeStackNavigator();

const MainNavigator = () => (
  <MainStack.Navigator screenOptions={{ headerShown: false }}>
    <MainStack.Screen name="MainTabs" component={MainTabs} />
    <MainStack.Screen
      name="IncomingCall"
      component={IncomingCallScreen}
      options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
    />
    <MainStack.Screen
      name="OutgoingCall"
      component={OutgoingCallScreen}
      options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
    />
    <MainStack.Screen
      name="OngoingCall"
      component={OngoingCallScreen}
      options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
    />
  </MainStack.Navigator>
);


const CallNavigationHandler = () => {
  const { callState } = useCall();
  const prevCallStateRef = useRef(callState);

  useEffect(() => {
    if (!navigationRef.isReady()) return;

    const currentRoute = navigationRef.getCurrentRoute()?.name;

    // 1. RESTORED: App will now show YOUR custom IncomingCall screen!
    if (callState === 'ringing_incoming') {
      if (currentRoute !== 'IncomingCall') {
        navigationRef.navigate('IncomingCall');
      }
    } else if (callState === 'ringing_outgoing') {
      if (currentRoute !== 'OutgoingCall') {
        navigationRef.navigate('OutgoingCall');
      }
    } else if (callState === 'connected') {
      if (currentRoute !== 'OngoingCall') {
        // Replaces ringing screen with ongoing call screen (fixes flicker)
        if (currentRoute === 'IncomingCall' || currentRoute === 'OutgoingCall') {
          navigationRef.dispatch(StackActions.replace('OngoingCall'));
        } else {
          navigationRef.navigate('OngoingCall');
        }
      }
    } else if (callState === 'ended') {
      // ONLY trigger on ended to prevent double-flashing
      if (['IncomingCall', 'OutgoingCall', 'OngoingCall'].includes(currentRoute)) {
        if (navigationRef.canGoBack()) {
          navigationRef.goBack();
        }
      }
    }

    prevCallStateRef.current = callState;
  }, [callState]);

  return null;
};

const AppNavigator = () => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      const unsubscribe = setupNotificationListeners(navigationRef);
      return () => {
        unsubscribe?.();
      };
    }
  }, [user]);

  if (loading) return null;
  const needsPhone = Boolean(
    user?.phone && typeof user.phone === 'string' && user.phone.startsWith('pending-')
  );

  let content;
  if (!user) {
    content = <AuthNavigator />;
  } else if (needsPhone) {
    content = <AddPhoneNavigator />;
  } else {
    content = <MainNavigator />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <View style={{ flex: 1, backgroundColor: colors.darkBackground }}>
        {user && !needsPhone && <CallNavigationHandler />}
        {content}
        {user && !needsPhone && <ReminderBanner />}
      </View>
    </NavigationContainer>
  );
};

const navStyles = StyleSheet.create({
  bottomNavBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cardBackground,
    height: 75,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
    paddingBottom: 8,
  },
  tabBarItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 24,
    height: 3,
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  headerBackIcon: {
    width: 24,
    height: 24,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
});

export default AppNavigator;