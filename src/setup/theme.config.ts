import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';

export const themeConfig = definePreset(Lara, {
  semantic: {
    primary: {
      50: '#ecf7ed',
      100: '#cfeecd',
      200: '#a2dd9f',
      300: '#6bc767',
      400: '#3cb038',
      500: '#20a038',
      600: '#167f2b',
      700: '#146424',
      800: '#135020',
      900: '#11421d',
      950: '#08250e'
    }
  }
});