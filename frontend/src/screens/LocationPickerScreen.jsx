import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Alert,
  StatusBar,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { colors, spacing, fontSizes } from '../theme/theme';

// Dynamic safe area status bar offset for Android & iOS
const STATUS_BAR_OFFSET = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10;

// Sensible default region (Lahore city center) rendered immediately before GPS locks
const DEFAULT_REGION = {
  latitude: 31.5204,
  longitude: 74.3587,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Android 12+ requires requesting both FINE and COARSE location together.
// Execution proceeds as long as at least one permission is GRANTED.
const requestLocationPermission = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const statuses = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const fineGranted =
      statuses[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const coarseGranted =
      statuses[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;

    return fineGranted || coarseGranted;
  } catch (err) {
    console.warn('Location permission request error:', err);
    return false;
  }
};

// Robust Geolocation helper:
// 1. Initial attempt with { enableHighAccuracy: true, timeout: 30000ms }
// 2. Immediate fallback to { enableHighAccuracy: false, timeout: 25000ms, maximumAge: 300000ms }
//    for network / Wi-Fi cell tower location if GPS times out or errors.
const getCurrentPositionWithFallback = (onSuccess, onError) => {
  Geolocation.getCurrentPosition(
    (position) => {
      onSuccess(position);
    },
    (gpsError) => {
      console.warn(
        'GPS high accuracy timed out or failed. Falling back to low accuracy (cell/Wi-Fi):',
        gpsError
      );
      Geolocation.getCurrentPosition(
        (fallbackPosition) => {
          onSuccess(fallbackPosition);
        },
        (fallbackError) => {
          console.warn('Network cell/Wi-Fi location fallback also failed:', fallbackError);
          onError(fallbackError, gpsError);
        },
        { enableHighAccuracy: false, timeout: 25000, maximumAge: 300000 }
      );
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
  );
};

const LocationPickerScreen = ({ navigation }) => {
  const mapRef = useRef(null);

  const [userLocation, setUserLocation] = useState(null); // { latitude, longitude, accuracy }
  const [selectedLocation, setSelectedLocation] = useState(null); // { latitude, longitude, name, address }
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Fetch current GPS position with fallback
  const fetchCurrentLocation = useCallback(async (isRefresh = false) => {
    setLoadingLocation(true);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission was denied. Please enable location permissions in your device settings to share your location.'
        );
        setLoadingLocation(false);
        return;
      }

      getCurrentPositionWithFallback(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const loc = { latitude, longitude, accuracy };
          setUserLocation(loc);
          setSelectedLocation({
            latitude,
            longitude,
            name: 'My Location',
            address: `Accurate to ${Math.round(accuracy || 15)}m`,
          });
          setLoadingLocation(false);

          // Animate map view to user position smoothly once coordinates arrive
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude,
                longitude,
                latitudeDelta: 0.007,
                longitudeDelta: 0.007,
              },
              600
            );
          }
        },
        (error) => {
          console.warn('Geolocation failed on both high and low accuracy attempts:', error);
          setLoadingLocation(false);
          Alert.alert(
            'Location Error',
            'Could not retrieve your current location. Please verify that GPS/Location services are enabled on your device.'
          );
        }
      );
    } catch (err) {
      console.error('fetchCurrentLocation error:', err);
      setLoadingLocation(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  // Recenter map camera on user's current GPS location
  const recenterMap = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.007,
          longitudeDelta: 0.007,
        },
        500
      );
      setSelectedLocation({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        name: 'My Location',
        address: `Accurate to ${Math.round(userLocation.accuracy || 15)}m`,
      });
    } else {
      fetchCurrentLocation();
    }
  };

  // Pass selected location payload back to ChatRoomScreen
  const handleSendLocation = (locationItem) => {
    const loc = locationItem || selectedLocation || userLocation;
    if (!loc || !loc.latitude || !loc.longitude) {
      Alert.alert('Error', 'Please wait for your location or tap the map to select a pin.');
      return;
    }

    navigation.navigate('ChatRoom', {
      selectedLocation: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        name: loc.name || 'Pinned Location',
        address: loc.address || `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`,
      },
    });
  };

  const activePin = selectedLocation || userLocation;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Full-Screen Interactive Map View */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          setSelectedLocation({
            latitude,
            longitude,
            name: 'Selected Pin Location',
            address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          });
        }}
      >
        {activePin && (
          <Marker
            coordinate={{
              latitude: activePin.latitude,
              longitude: activePin.longitude,
            }}
            title={activePin.name || 'Selected Pin'}
            description={activePin.address || `${activePin.latitude.toFixed(5)}, ${activePin.longitude.toFixed(5)}`}
            pinColor={colors.primary}
          />
        )}
      </MapView>

      {/* Non-blocking Floating Acquiring GPS indicator */}
      {loadingLocation && (
        <View style={styles.acquiringGpsPill}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.acquiringGpsText}>Acquiring GPS location...</Text>
        </View>
      )}

      {/* Top Header Overlay */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Image
            source={require('../assets/icons/back.png')}
            style={styles.headerBtnIcon}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send location</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => fetchCurrentLocation(true)}
          activeOpacity={0.8}
        >
          <Image
            source={require('../assets/icons/sync.png')}
            style={styles.headerBtnIcon}
          />
        </TouchableOpacity>
      </View>

      {/* Floating Recenter Button */}
      <TouchableOpacity
        style={styles.recenterBtn}
        activeOpacity={0.8}
        onPress={recenterMap}
      >
        <Image
          source={require('../assets/icons/pin.png')}
          style={styles.recenterIcon}
        />
      </TouchableOpacity>

      {/* Fixed Bottom Card: Selected Pin Info & Send Button */}
      <View style={styles.bottomBar}>
        <View style={styles.locationInfoRow}>
          <View style={styles.locationPinCircle}>
            <Image
              source={require('../assets/icons/pin.png')}
              style={styles.locationPinIcon}
            />
          </View>
          <View style={styles.locationTextWrap}>
            <Text style={styles.locationTitle} numberOfLines={1}>
              {activePin?.name || (loadingLocation ? 'Acquiring GPS signal...' : 'Tap map to drop pin')}
            </Text>
            <Text style={styles.locationSubtitle} numberOfLines={1}>
              {activePin?.address ||
                (activePin
                  ? `${activePin.latitude.toFixed(5)}, ${activePin.longitude.toFixed(5)}`
                  : 'Move map or tap anywhere to place a pin')}
            </Text>
          </View>
        </View>

        {/* Fixed 'Send Selected Location' Button */}
        <TouchableOpacity
          style={[styles.sendButton, !activePin && styles.sendButtonDisabled]}
          activeOpacity={0.8}
          onPress={() => handleSendLocation(activePin)}
          disabled={!activePin}
        >
          <Image
            source={require('../assets/icons/send.png')}
            style={styles.sendButtonIcon}
          />
          <Text style={styles.sendButtonText}>Send Selected Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.darkBackground,
  },
  topHeader: {
    position: 'absolute',
    top: STATUS_BAR_OFFSET,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(11, 15, 25, 0.88)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 10,
    elevation: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnIcon: {
    width: 18,
    height: 18,
    tintColor: colors.white,
    resizeMode: 'contain',
  },
  headerTitle: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  acquiringGpsPill: {
    position: 'absolute',
    top: STATUS_BAR_OFFSET + 58,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    elevation: 6,
    zIndex: 10,
  },
  acquiringGpsText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 160,
    right: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    zIndex: 10,
  },
  recenterIcon: {
    width: 22,
    height: 22,
    tintColor: colors.primary,
    resizeMode: 'contain',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    zIndex: 10,
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationPinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  locationPinIcon: {
    width: 22,
    height: 22,
    tintColor: colors.primary,
    resizeMode: 'contain',
  },
  locationTextWrap: {
    flex: 1,
  },
  locationTitle: {
    color: colors.white,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  locationSubtitle: {
    color: colors.gray,
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  sendButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonIcon: {
    width: 18,
    height: 18,
    tintColor: colors.white,
    marginRight: 8,
    resizeMode: 'contain',
  },
  sendButtonText: {
    color: colors.white,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});

export default LocationPickerScreen;
