import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.container}>
        <Icon name="alert-circle-outline" size={56} color="#EF4444" />
        <Text style={s.title}>Algo salió mal</Text>
        <Text style={s.desc}>
          Ocurrió un error inesperado. Tus datos están seguros.
        </Text>
        <Pressable style={s.btn} onPress={() => this.setState({ hasError: false, message: '' })}>
          <Text style={s.btnText}>Intentar de nuevo</Text>
        </Pressable>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    padding: 32,
    gap: 16,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  desc: { color: '#8E8E93', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
