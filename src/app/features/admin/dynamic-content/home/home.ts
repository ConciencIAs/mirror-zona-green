import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy, signal, input, inject } from '@angular/core';
import grapesjs, { Editor } from 'grapesjs';
import plugin from "grapesjs-tailwind";
import gjsBlocksBasic from 'grapesjs-blocks-basic';
import customCodePlugin from 'grapesjs-custom-code';
import gjsParserPostcss from 'grapesjs-parser-postcss';
import 'grapesjs/dist/css/grapes.min.css';
import { ContentDbService } from '@src/app/core/services/supabase/dynamic-content/content-db-page.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';

const escapeName = (name: string) => `${name}`.trim().replace(/([^a-z0-9\w-:/]+)/gi, '-');

const BUCKET_NAME = 'home_image'

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styles: ``
})
export class Home implements AfterViewInit, OnDestroy {
  @ViewChild('gjs', { static: true }) gjsContainer!: ElementRef;

  private contentDbService = inject(ContentDbService);
  private toastService = inject(ToastService);
  // Recibe datos previos de Supabase si estamos editando una landing existente
  datosIniciales = signal<any>(null);


  id = signal<string>('')


  private editor?: Editor;

  ngAfterViewInit(): void {
    this.initEditor();
  }

  private initEditor(): void {
    this.editor = grapesjs.init({
      container: this.gjsContainer.nativeElement,
      height: '100%',
      width: 'auto',

      fromElement: false,
      storageManager: false, // Desactivamos almacenamiento local para manejarlo por API,

      // 🔌 CONFIGURACIÓN DE PLUGINS
      plugins: [gjsBlocksBasic, plugin, customCodePlugin, gjsParserPostcss],
      pluginsOpts: {
        [plugin as any]: {
          autoBuild: true
        }
      },

      canvas: {
        styles: [
          // Inyectamos Tailwind en el lienzo para poder usar clases de diseño rápidas
        ],
        scripts: [
        ]
      }
    });
    this.gjsContainer.nativeElement.setAttribute('style', 'width: 100%; height: 100%;');

    const domComponents = this.editor.DomComponents;

    // 🚀 1. OBTENEMOS EL COMPONENTE BASE "DEFAULT"
    const defaultType = domComponents.getType('default');

    // 🚀 2. LO RE-DEFINIMOS PARA INYECTAR NUESTRA LÓGICA A TODO EL ECOSISTEMA
    domComponents.addType('default', {
      model: {
        defaults: {
          // Unimos los traits nativos (ID, Título, etc.) con nuestro selector de acceso
          traits: [
            ...defaultType.model.prototype.defaults.traits,
            {
              type: 'select',
              name: 'data-access', // Vincula al atributo HTML
              label: 'Permisos de Visibilidad',
              changeProp: true,   // Dispara el evento de cambio
              options: [
                { value: 'both', name: '👥 Ambos (Público)' },
                { value: 'anonymous', name: '🔒 Solo Anónimos' },
                { value: 'logged-in', name: '🔑 Solo Logueados' }
              ]
            }
          ],
        },

        // 🚀 3. ESCUCHADOR GLOBAL
        // Cada vez que cualquier elemento cambie su opción, se actualiza su HTML real
        init() {
          this.on('change:data-access', this['handleGlobalAccessChange']);
        },
        handleGlobalAccessChange() {
          const valorAccess = this.get('data-access');
          this.addAttributes({ 'data-access': valorAccess });
        }
      }
    });

    // Si nos pasaron datos previos de una edición, los cargamos en el lienzo
    this.loadContent()
  }

  async exportarDiseno(): Promise<void> {
    if (!this.editor) return;

    // 1. OBTENEMOS EL JSON: Ideal para volver a cargar el editor en el futuro (columna jsonb)
    const datosProyectoJson = this.editor.getProjectData();

    // 2. OBTENEMOS HTML Y CSS: Ideales para renderizar al usuario final de forma ultra rápida
    const htmlRenderizado = this.editor.getHtml();
    const cssRenderizado = this.editor.getCss() || '';
    try {
      const { data, error } = await this.contentDbService.updateContent(this.id(), {
        project_data: datosProyectoJson,
        html_content: htmlRenderizado,
        css_content: cssRenderizado
      })
      if (data) {
        this.toastService.success("Contenido guardado exitosamente")
      }
      if (error) {
        this.toastService.error("Error al guardar el contenido")
      }
    } catch (error) {
      this.toastService.error("Error al guardar el contenido")
    }

    // Emitimos los datos hacia el componente padre encargado de la persistencia
    console.log('Json:', datosProyectoJson);
    console.log('Html:', htmlRenderizado);
    console.log('Css:', cssRenderizado);
  }

  async loadContent() {
    try {
      const { data, error } = await this.contentDbService.getContentParaEditor()
      if (data) {
        this.datosIniciales.set(JSON.parse(data.project_data));
        this.id.set(data.id);
        if (this.editor && this.datosIniciales()) {
          this.editor.loadProjectData(this.datosIniciales());
        }
      }
      if (error) {
        this.toastService.error("Error al cargar el contenido" + error.message)
      }
    } catch (error) {
      this.toastService.error("Error al cargar el contenido" + error)
    }
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.destroy();
    }
  }


}
