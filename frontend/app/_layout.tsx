import { Slot, Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <StatusBar style="auto" />
        <AuthProvider>
          <Slot />
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}