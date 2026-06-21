import {
  Component, ElementRef, ViewChild, AfterViewInit,
  OnDestroy, signal, inject, OnInit
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import grapesjs, { Editor } from 'grapesjs';
import plugin from 'grapesjs-tailwind';
import gjsBlocksBasic from 'grapesjs-blocks-basic';
import customCodePlugin from 'grapesjs-custom-code';
import gjsParserPostcss from 'grapesjs-parser-postcss';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';

import { ContentDbService } from '@src/app/core/services/supabase/dynamic-content/content-db-page.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';

@Component({
  selector: 'app-content-editor',
  imports: [ButtonModule, InputTextModule, DialogModule, FormsModule],
  templateUrl: './editor.html',
  styles: ``
})
export class ContentEditor implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gjs', { static: true }) gjsContainer!: ElementRef;

  private contentDbService = inject(ContentDbService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Estado del editor
  id = signal<string>('');
  isNewMode = signal(false);
  isLoading = signal(false);
  isSaving = signal(false);

  // Modal de nueva página
  showNewModal = signal(false);
  newPageName = signal('');
  newPageSlug = signal('');

  private editor?: Editor;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.id.set(id);
      this.isNewMode.set(false);
    } else {
      this.isNewMode.set(true);
    }
  }

  ngAfterViewInit(): void {
    this.initEditor();
  }

  private initEditor(): void {
    this.editor = grapesjs.init({
      container: this.gjsContainer.nativeElement,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,

      plugins: [gjsBlocksBasic, plugin, customCodePlugin, gjsParserPostcss],
      pluginsOpts: {
        [plugin as any]: { autoBuild: true }
      },

      canvas: { styles: [], scripts: [] }
    });

    this.gjsContainer.nativeElement.setAttribute('style', 'width: 100vw; height: 100vh;');

    // Extender el tipo default con el trait de permisos
    const domComponents = this.editor.DomComponents;
    const defaultType = domComponents.getType('default');
    domComponents.addType('default', {
      model: {
        defaults: {
          traits: [
            ...defaultType.model.prototype.defaults.traits,
            {
              type: 'select',
              name: 'data-access',
              label: 'Permisos de Visibilidad',
              changeProp: true,
              options: [
                { value: 'both', name: '👥 Ambos (Público)' },
                { value: 'anonymous', name: '🔒 Solo Anónimos' },
                { value: 'logged-in', name: '🔑 Solo Logueados' }
              ]
            }
          ],
        },
        init() {
          this.on('change:data-access', this['handleGlobalAccessChange']);
        },
        handleGlobalAccessChange() {
          const valorAccess = this.get('data-access');
          this.addAttributes({ 'data-access': valorAccess });
        }
      }
    });

    // Si es modo edición, cargamos el contenido
    if (!this.isNewMode()) {
      this.loadContent();
    } else {
      // En modo crear, abrimos el modal para nombre y slug
      this.showNewModal.set(true);
    }
  }

  async loadContent(): Promise<void> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.contentDbService.getContentParaEditor(this.id());
      if (data) {
        if (data.project_data && this.editor) {
          this.editor.loadProjectData(JSON.parse(data.project_data));
        }
      }
      if (error) {
        this.toastService.error('Error al cargar el contenido: ' + error.message);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  async guardarDiseno(): Promise<void> {
    if (!this.editor) return;
    this.isSaving.set(true);

    const datosProyectoJson = this.editor.getProjectData();
    const htmlRenderizado = this.editor.getHtml();
    const cssRenderizado = this.editor.getCss() || '';

    try {
      if (this.isNewMode()) {
        // CREAR
        const { data, error } = await this.contentDbService.createContent({
          name: this.newPageName(),
          slug: this.newPageSlug(),
          project_data: datosProyectoJson,
          html_content: htmlRenderizado,
          css_content: cssRenderizado,
        });
        if (data) {
          this.toastService.success('Página creada exitosamente');
          this.id.set((data as any).id);
          this.isNewMode.set(false);
        }
        if (error) {
          this.toastService.error('Error al crear la página: ' + error.message);
        }
      } else {
        // ACTUALIZAR
        const { data, error } = await this.contentDbService.updateContent(this.id(), {
          project_data: datosProyectoJson,
          html_content: htmlRenderizado,
          css_content: cssRenderizado,
        });
        if (data) {
          this.toastService.success('Contenido guardado exitosamente');
        }
        if (error) {
          this.toastService.error('Error al guardar: ' + error.message);
        }
      }
    } finally {
      this.isSaving.set(false);
    }
  }

  generateSlug(): void {
    const slug = this.newPageName()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    this.newPageSlug.set(slug);
  }

  cancelNewModal(): void {
    this.showNewModal.set(false);
    this.router.navigate(['/admin/dynamic-content']);
  }

  confirmNewPage(): void {
    if (!this.newPageName().trim() || !this.newPageSlug().trim()) {
      this.toastService.error('El nombre y el slug son obligatorios');
      return;
    }
    this.showNewModal.set(false);
  }

  goBack(): void {
    this.router.navigate(['/admin/dynamic-content']);
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.destroy();
    }
  }
}
