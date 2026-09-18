import { Platform } from 'react-native';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import RNFS from 'react-native-fs';

/**
 * Standard configuration defaults for image compression
 * - Max 1600px on the longest dimension
 * - 80% JPEG quality (represented as 80 in ImageResizer, or 0.8)
 */
export const DEFAULT_COMPRESSION_OPTIONS = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8, // 0.0 - 1.0 (will map to 0 - 100 for resizer)
  format: 'JPEG',
  rotation: 0,
  keepMeta: false,
  mode: 'contain',
  onlyScaleDown: true,
};

/**
 * Normalizes local file URIs across platforms (Android, iOS)
 */
export const normalizeImageUri = (uri) => {
  if (!uri || typeof uri !== 'string') return uri;
  const trimmed = uri.trim();
  // Ensure Android file paths have the file:// scheme when needed
  if (Platform.OS === 'android' && trimmed.startsWith('/') && !trimmed.startsWith('file://')) {
    return `file://${trimmed}`;
  }
  return trimmed;
};

/**
 * Resizes and compresses an image file using @bam.tech/react-native-image-resizer.
 * Returns an object with { uri, path, size, width, height, name }.
 * 
 * If native ImageResizer fails (e.g. unlinked module or invalid format),
 * safely returns fallback metadata pointing to the original URI.
 */
export const compressImage = async (imageUri, options = {}) => {
  if (!imageUri) {
    throw new Error('Image URI is required for compression.');
  }

  const normalizedUri = normalizeImageUri(imageUri);
  const mergedOptions = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };

  // Map 0.0 - 1.0 quality float to 0 - 100 integer if necessary
  let qualityInt = mergedOptions.quality;
  if (qualityInt <= 1) {
    qualityInt = Math.round(qualityInt * 100);
  }
  qualityInt = Math.max(1, Math.min(100, qualityInt));

  try {
    if (!ImageResizer || typeof ImageResizer.createResizedImage !== 'function') {
      console.warn('[imageCompressor] ImageResizer native module not found, returning original image.');
      return {
        uri: normalizedUri,
        path: normalizedUri.replace('file://', ''),
        fallback: true,
      };
    }

    const response = await ImageResizer.createResizedImage(
      normalizedUri,
      mergedOptions.maxWidth,
      mergedOptions.maxHeight,
      mergedOptions.format || 'JPEG',
      qualityInt,
      mergedOptions.rotation || 0,
      undefined, // default outputPath (cache dir)
      mergedOptions.keepMeta || false,
      {
        mode: mergedOptions.mode || 'contain',
        onlyScaleDown: mergedOptions.onlyScaleDown !== false,
      }
    );

    return {
      uri: response.uri || normalizedUri,
      path: response.path || response.uri,
      name: response.name,
      size: response.size,
      width: response.width,
      height: response.height,
      fallback: false,
    };
  } catch (err) {
    console.warn('[imageCompressor] Compression failed, falling back to original image:', err.message || err);
    return {
      uri: normalizedUri,
      path: normalizedUri.replace('file://', ''),
      fallback: true,
      error: err.message,
    };
  }
};

/**
 * Converts a local image file URI into a standard base64 data URL:
 * "data:image/jpeg;base64,..."
 */
export const fileUriToBase64 = async (uri) => {
  if (!uri) return null;

  // Already a base64 data URL
  if (uri.startsWith('data:')) {
    return uri;
  }

  // Determine mime type from file extension
  let mimeType = 'image/jpeg';
  const cleanUri = uri.split('?')[0].toLowerCase();
  if (cleanUri.endsWith('.png')) {
    mimeType = 'image/png';
  } else if (cleanUri.endsWith('.webp')) {
    mimeType = 'image/webp';
  } else if (cleanUri.endsWith('.gif')) {
    mimeType = 'image/gif';
  }

  // Priority 1: Native file system read via react-native-fs (reliable on Android and iOS)
  try {
    if (RNFS && typeof RNFS.readFile === 'function') {
      const cleanPath = decodeURIComponent(uri.replace(/^file:\/\//, ''));
      const rawBase64 = await RNFS.readFile(cleanPath, 'base64');
      if (rawBase64) {
        return `data:${mimeType};base64,${rawBase64}`;
      }
    }
  } catch (fsErr) {
    console.warn('[imageCompressor] RNFS.readFile failed, trying fetch fallback:', fsErr.message || fsErr);
  }

  // Priority 2: Fallback to fetch + FileReader for blob/remote URIs
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('[imageCompressor] Failed to convert image to base64:', err);
    throw err;
  }
};

/**
 * Unified pipeline:
 * 1. Resizes to max 1600px (or custom dimension) and compresses to ~80% JPEG quality.
 * 2. Encodes the resulting lightweight compressed file into a base64 data URL.
 * 
 * Returns { uri, base64, size, width, height, fallback }.
 */
export const compressAndConvertToBase64 = async (imageUri, options = {}) => {
  if (!imageUri) {
    throw new Error('Image URI is required.');
  }

  // 1. Compress image
  const compressionResult = await compressImage(imageUri, options);
  const targetUri = compressionResult.uri || imageUri;

  // 2. Read to base64
  let base64 = null;
  try {
    base64 = await fileUriToBase64(targetUri);
  } catch (base64Err) {
    // If reading the compressed file failed for any reason, try original URI as final fallback
    if (targetUri !== imageUri) {
      console.warn('[imageCompressor] Failed reading compressed URI, trying original URI fallback.');
      base64 = await fileUriToBase64(imageUri);
    } else {
      throw base64Err;
    }
  }

  return {
    ...compressionResult,
    base64,
  };
};

export default {
  compressImage,
  fileUriToBase64,
  compressAndConvertToBase64,
  DEFAULT_COMPRESSION_OPTIONS,
};
