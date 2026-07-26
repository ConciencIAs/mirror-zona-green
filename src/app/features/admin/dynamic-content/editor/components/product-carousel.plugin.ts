import type { Editor, Plugin } from 'grapesjs';

export interface ProductCarouselOptions {
  sbUrl: string;
  sbKey: string;
}

const plugin: Plugin<any> = (editor: Editor, opts: any = {}) => {
  const options = {
    sbUrl: '',
    sbKey: '',
    ...opts,
  };

  const blockId = 'product-carousel';
  const componentId = 'product-carousel';

  // Añadir Bloque
  editor.BlockManager.add(blockId, {
    label: 'Carousel Productos',
    category: 'Componentes Dinámicos',
    content: { type: componentId },
    media: `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M7 19h10V4H7v15zm-5-2h4V6H2v11zM18 6v11h4V6h-4z"/></svg>`,
  });

  // El Web Component de Angular
  editor.DomComponents.addType('el-dynamic-carousel', {
    isComponent: el => el.tagName === 'EL-DYNAMIC-CAROUSEL',
    model: {
      defaults: {
        name: 'Carrusel Dinámico',
        tagName: 'el-dynamic-carousel',
        droppable: false,
        attributes: {
          'filter-by': 'recent',
          'filter-value': ''
        },
        traits: [
          {
            type: 'select',
            label: 'Filtrar por',
            name: 'filter-by',
            options: [
              { id: 'recent', name: 'Más Recientes' },
              { id: 'sku', name: 'Por SKU' }
            ]
          },
          {
            type: 'text',
            label: 'SKUs (separados por coma)',
            name: 'filter-value',
            placeholder: 'ej: ZG-001, ZG-002'
          }
        ]
      }
    }
  });

  // Definir Componente Contenedor
  editor.DomComponents.addType(componentId, {
    model: {
      defaults: {
        name: 'Carousel Productos',
        classes: ['product-carousel-wrapper', 'w-full', 'my-8', 'block'],
        components: [
          {
            type: 'text',
            content: 'Nuestros Productos',
            classes: ['text-2xl', 'font-bold', 'text-[#122011]', 'mb-4', 'px-4'],
          },
          {
            type: 'el-dynamic-carousel',
          }
        ]
      }
    }
  });
};

export default plugin;
