import { Component, inject, signal, ChangeDetectionStrategy, computed, DOCUMENT, Inject, OnInit, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ContentDbService } from '@src/app/core/services/supabase/dynamic-content/content-db-page.service';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { UserStore } from '@src/app/core/state/customer/customer.state';

@Component({
  selector: 'app-customer-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './home.html',
})
export class CustomerHome implements OnInit, OnDestroy {
  private readonly authService = inject(SupabaseAuthService);
  private contentDbService = inject(ContentDbService);
  private sanitizer = inject(DomSanitizer);
  private userState = inject(UserStore);

  private styleElement: HTMLStyleElement | null = null;
  private scriptElement: HTMLScriptElement | null = null;

  constructor(@Inject(DOCUMENT) private document: Document) {
  }

  private toastService = inject(ToastService);

  public renderHtml = signal<SafeHtml | undefined>(undefined);
  protected isAuthenticated = computed(() => this.authService.isAuthenticated() && this.userState.perfil().status === 'activo');


  async ngOnInit(): Promise<void> {
    const { data, error } = await this.contentDbService.getContentHome();
    if (data) {
      const html = data.html_content;

      const css = data.css_content;
      const js = data.js_content;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      const elementosCondicionales = tempDiv.querySelectorAll('[data-access]');
      elementosCondicionales.forEach((el: any) => {
        const accessRule = el.attributes['data-access']?.nodeValue;

        if (accessRule === 'logged-in' && !this.isAuthenticated()) {
          el.remove(); // Se elimina del DIV temporal
        } else if (accessRule === 'anonymous' && this.isAuthenticated()) {
          el.remove(); // Se elimina del DIV temporal
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

        // La confirmación se coloca después de insertar el nodo
        console.log('Script inyectado y ejecutado exitosamente');

      }
    }
    if (error) {
      console.error('Error al cargar el contenido:', error);
      this.toastService.error('Error al cargar el contenido', 'Error al cargar el contenido');
    }
  }

  ngOnDestroy() {
    // Limpieza al destruir el componente
    this.styleElement?.remove();
    this.scriptElement?.remove();
  }
}
