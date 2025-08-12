import React from 'react';
import { Text as RNText, View as RNView, TextInput as RNTextInput, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';

export function View(props: React.ComponentProps<typeof RNView>) {
  return <RNView {...props} />;
}

export function Text(props: React.ComponentProps<typeof RNText>) {
  return <RNText style={[{ color: colors.text }, props.style]} {...props} />;
}

export function TextInput(props: React.ComponentProps<typeof RNTextInput>) {
  return (
    <RNTextInput
      placeholderTextColor={colors.mutedText}
      style={[styles.input, props.style]}
      {...props}
    />
  );
}

export function Button({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <RNText style={styles.buttonText}>{title}</RNText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff'
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '600'
  }
});
