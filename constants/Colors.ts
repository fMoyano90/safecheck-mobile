/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark theme.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
  // Núcleo Gestor Brand Colors
  NucleoGestor: {
    primary: '#ff6d00',      // Naranja principal
    primaryLight: '#ff834d', // Naranja claro
    primaryDark: '#cc5200',  // Naranja oscuro
    secondary: '#0066cc',    // Azul Núcleo Gestor
    loading: '#ff6d00',      // Color para todos los loading indicators
    loadingLight: '#ff834d', // Color alternativo para loading
  }
};
