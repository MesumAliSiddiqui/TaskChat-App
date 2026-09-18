import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, fontSizes } from '../../theme/theme';

const TaskBanner = ({ activeTaskCount, onPress, styles }) => {
  return (
    <TouchableOpacity style={styles.taskBanner} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.taskBannerLeft}>
        <View style={styles.taskBannerIconBox}>
          <Image source={require('../../assets/icons/task.png')} style={styles.taskBannerIcon} />
        </View>
        <View>
          <Text style={styles.taskBannerTitle}>Tasks</Text>
          <Text style={styles.taskBannerSub}>{activeTaskCount} Remaining</Text>
        </View>
      </View>
      <Text style={styles.taskBannerArrow}>›</Text>
    </TouchableOpacity>
  );
};

export default TaskBanner;
