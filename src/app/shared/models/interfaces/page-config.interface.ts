// ==========================================
// INTERFACES PARA CONFIGURACIÓN DE LA APP (PAGE_CONFIG)
// ==========================================

export interface NavItem {
  path: string;
  label: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
  roles?: string[]; // roles permitidos, ej: ['admin'], ['agente'], ['customer']
}

export interface FooterItem {
  label: string;
  url: string;
}

export interface FooterSection {
  title: string;
  items: FooterItem[];
}

export interface ContactConfig {
  whatsapp_phone: string;
  whatsapp_link: string;
  email: string;
  direccion: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
}

export interface AdvertisingItem {
  text: string;
  link: string;
  icon: string; // PrimeIcons class, ej: 'pi pi-megaphone'
}

// ==========================================
// SEPARATED CONFIG TYPES
// ==========================================

export interface NavbarConfig {
  sections: NavSection[];
  background_color: string;
}

export interface FooterConfig {
  sections: FooterSection[];
  contact: ContactConfig;
  social: SocialLinks;
  texto_copyright: string;
  background_color: string;
}

export interface SettingsConfig {
  nombre: string;
  logo_url: string;
  telefono: string;
}

export interface AdvertisingBannerConfig {
  items: AdvertisingItem[];
}

// Union type for config names
export type ConfigName = 'navbar' | 'footer' | 'settings' | 'advertising_banner';

// Cache structure with TTL
export interface ConfigCache<T> {
  data: T;
  expiresAt: number; // timestamp in milliseconds
}

// Legacy - still used for compatibility
export interface AppConfig {
  nombre: string;
  logo_url: string;
  telefono: string;
  navbar: {
    sections: NavSection[];
    background_color: string;
  };
  footer: {
    sections: FooterSection[];
    contact: ContactConfig;
    social: SocialLinks;
    texto_copyright: string;
    background_color: string;
  };
  advertising_banner: AdvertisingItem[];
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  nombre: 'Zona Green',
  logo_url: '/images/logo-zona-green-blanco.svg',
  telefono: '+57 300 123 4567',
  navbar: {
    sections: [
      {
        title: 'Navegación',
        items: [
          { path: '/customer/home', label: 'Inicio' },
          { path: '/cannabismedicinalencolombia', label: 'Cannabis medicinal en Colombia' },
          { path: '/medicoscannabiscolombia', label: 'Médicos especialistas en cannabis' },
          { path: '/rrd', label: 'Reducción de Riesgos y Daños' },
          { path: '/faq', label: 'Preguntas frecuentes' },
          { path: '/terminos-y-condiciones', label: 'Términos y condiciones' },
        ]
      },
      {
        title: 'Cuenta',
        roles: ['customer', 'admin', 'agente'],
        items: [
          { path: '/marketplace', label: 'Marketplace' }
        ]
      },
      {
        title: 'Administración',
        roles: ['admin'],
        items: [
          { path: '/admin', label: 'Panel admin' },
          { path: '/admin/marketplace', label: 'Marketplace admin' },
          { path: '/admin/marketplace/products', label: 'Productos' },
          { path: '/admin/marketplace/custom', label: 'Custom search' },
          { path: '/admin/marketplace/orders', label: 'Órdenes admin' },
          { path: '/admin/dynamic-content', label: 'Contenido dinámico' },
          { path: '/admin/dynamic-content/app-config', label: 'Configuraciones' },
        ]
      },
      {
        title: 'Agente',
        roles: ['agente'],
        items: [
          { path: '/admin', label: 'Panel agente' },
          { path: '/admin/marketplace', label: 'Marketplace agente' },
          { path: '/admin/marketplace/orders', label: 'Órdenes' },
          { path: '/admin/marketplace/custom', label: 'Custom search' },
        ]
      }
    ],
    background_color: '#102e10'
  },
  footer: {
    sections: [
      {
        title: 'NAVEGACIÓN',
        items: [
          { label: 'Inicio', url: '/customer/home' },
          { label: 'Cannabis medicinal', url: '/cannabismedicinalencolombia' },
          { label: 'Preguntas frecuentes', url: '/faq' }
        ]
      },
      {
        title: 'LEGAL',
        items: [
          { label: 'Términos y condiciones', url: '/terminos-y-condiciones' },
          { label: 'Política de privacidad', url: '#' },
          { label: 'Tratamiento de datos', url: '#' },
          { label: 'Capítulo legal', url: '#' },
          { label: 'Aviso de cookies', url: '#' }
        ]
      },
      {
        title: 'AYUDA',
        items: [
          { label: 'Centro de ayuda', url: '#' },
          { label: 'Contacto', url: '#' },
          { label: 'Trabaja con nosotros', url: '#' }
        ]
      }
    ],
    contact: {
      whatsapp_phone: '+57 300 123 4567',
      whatsapp_link: 'https://wa.me/573001234567',
      email: 'hola@zonagreen.co',
      direccion: 'Bogotá, Colombia'
    },
    social: {
      instagram: '#',
      facebook: '#',
      linkedin: '#',
      youtube: '#'
    },
    texto_copyright: '© 2025 Zona Green. Todos los derechos reservados.',
    background_color: '#0f1e0f'
  },
  advertising_banner: [
    { text: '¡Envío gratis por compras superiores a $100k!', link: '/marketplace', icon: 'pi pi-shopping-bag' }
  ]
};
