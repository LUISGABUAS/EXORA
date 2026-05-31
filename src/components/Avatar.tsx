import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePremiumStore } from '../store/usePremiumStore';
import { useTheme } from '../theme/ThemeContext';

interface AvatarProps {
  size: number;
  name: string;
  showEdit?: boolean;
  onPress?: () => void;
}

export function Avatar({ size, name, showEdit, onPress }: AvatarProps) {
  const { colors } = useTheme();
  const avatarUri = usePremiumStore(state => state.avatarUri);
  const letter = name ? name[0].toUpperCase() : 'U';
  const fontSize = size * 0.4;
  const editSize = size * 0.3;

  const content = (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primary,
          },
        ]}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
            }}
          />
        ) : (
          <Text style={[styles.letter, { fontSize, color: colors.white }]}>
            {letter}
          </Text>
        )}
      </View>
      {showEdit ? (
        <View
          style={[
            styles.editBadge,
            {
              width: editSize,
              height: editSize,
              borderRadius: editSize / 2,
              backgroundColor: colors.primary,
              borderColor: colors.background,
            },
          ]}
        >
          <Icon
            name="camera"
            size={editSize * 0.52}
            color={colors.white}
          />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={4}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: {
    fontWeight: '800',
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
});
