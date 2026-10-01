import { Component, inject, signal, OnInit, ChangeDetectionStrategy, Inject, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ContentDbService } from '@src/app/core/services/supabase/dynamic-content/content-db-page.service';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-dynamic-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './dynamic-page.html',
})
export class DynamicPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(SupabaseAuthService);
  private readonly contentDbService = inject(ContentDbService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toastService = inject(ToastService);
  constructor(@Inject(DOCUMENT) private document: Document) { }

  private styleElement: HTMLStyleElement | null = null;
  private scriptElement: HTMLScriptElement | null = null;

  public renderHtml = signal<SafeHtml | undefined>(undefined);
  public loading = signal<boolean>(true);
  public notFound = signal<boolean>(false);
  public slug = signal<string | null>(null);

  protected isAuthenticated = this.authService.isAuthenticated;

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe(async (params) => {
      const slug = params['slug'];
      this.slug.set(slug ?? null);
      if (slug) {
        await this.loadPageContent(slug);
      } else {
        this.loading.set(false);
        this.notFound.set(true);
      }
    });
  }

  private async loadPageContent(slug: string): Promise<void> {
    this.loading.set(true);
    this.notFound.set(false);
    this.renderHtml.set(undefined);

    try {
      const { data, error } = await this.contentDbService.getContentBySlug(slug);
      if (error) {
        console.error('Error fetching dynamic page:', error);
        this.toastService.error('Error al cargar el contenido');
        this.notFound.set(true);
        return;
      }

      if (!data) {
        this.notFound.set(true);
        return;
      }

      const html = data.html_content;
      const css = data.css_content;
      const js = data.js_content;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      const conditionalElements = tempDiv.querySelectorAll('[data-access]');
      conditionalElements.forEach((el: any) => {
        const accessRule = el.attributes['data-access']?.nodeValue;

        if (accessRule === 'logged-in' && !this.isAuthenticated()) {
          el.remove();
        } else if (accessRule === 'anonymous' && this.isAuthenticated()) {
          el.remove();
        }
      });

      this.renderHtml.set(this.sanitizer.bypassSecurityTrustHtml(tempDiv.innerHTML));
      if (this.document) {
        const style = this.document.createElement('style');
        style.className = 'content-css'
        style.textContent = css;
        this.document.head.appendChild(style);
        this.styleElement = style

        const script = this.document.createElement('script');
        script.type = 'text/javascript';

        // Encapsular dentro de una IIFE para evitar colisiones de variables
        script.textContent = `
        (function() {
          try {
            ${js}
          } catch (err) {
            console.error('Error de ejecución en el script inyectado:', err);
          }
        })();
      `;
        this.scriptElement = script
        setTimeout(() => {

          this.document.head.appendChild(script);
        }, 2000)

      }
    } catch (err) {
      console.error('Unexpected error loading page content:', err);
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    // Limpieza al destruir el componente
    this.styleElement?.remove();
    this.scriptElement?.remove();
  }
}
