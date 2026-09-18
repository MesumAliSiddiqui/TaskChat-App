import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, fontSizes } from '../../theme/theme';

const ReplyBanner = ({ replyingTo, user, setReplyingTo, getImageSource, styles }) => {
  if (!replyingTo) return null;

  return (
    <View style={styles.replyBar}>
      <View style={styles.replyBarAccent} />
      <View style={styles.replyBarContent}>
        <Text style={styles.replyBarName} numberOfLines={1}>
          {replyingTo.sender?.name || ((replyingTo.sender?._id || replyingTo.sender?.id) === (user?._id || user?.id) ? 'You' : 'User')}
        </Text>
        <Text style={styles.replyBarText} numberOfLines={1}>
          {replyingTo.text
            ? replyingTo.text.startsWith('📍')
              ? replyingTo.text.split('\n')[0]
              : replyingTo.text.replace(/^💬 \[Reply to .*?: ".*?"\]\n/, '')
            : replyingTo.image || replyingTo.attachmentUrl
              ? '📷 Photo'
              : 'Message'}
        </Text>
      </View>
      {(replyingTo.image || replyingTo.attachmentUrl) && (
        <Image
          source={getImageSource(replyingTo)}
          style={styles.replyBarThumbnail}
          resizeMode="cover"
        />
      )}
      <TouchableOpacity
        style={styles.replyBarCloseBtn}
        onPress={() => setReplyingTo(null)}
        activeOpacity={0.7}
      >
        <Image source={require('../../assets/icons/close.png')} style={styles.replyBarCloseIcon} />
      </TouchableOpacity>
    </View>
  );
};

export default ReplyBanner;
