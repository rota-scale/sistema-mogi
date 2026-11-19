import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ProvedorDoApp } from '@/estado/app'
import { ProvedorDeLocal } from '@/estado/localizacao'
import { cores } from '@/tema'

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <ProvedorDoApp>
        <ProvedorDeLocal>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.creme } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="camera" options={{ animation: 'fade' }} />
            <Stack.Screen name="local" options={{ presentation: 'modal' }} />
            <Stack.Screen name="acompanhar/[protocolo]" />
          </Stack>
        </ProvedorDeLocal>
      </ProvedorDoApp>
    </SafeAreaProvider>
  )
}
