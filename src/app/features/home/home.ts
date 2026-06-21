import { Component, inject, signal, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ContentDbService } from '@src/app/core/services/supabase/dynamic-content/content-db-page.service';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';

@Component({
  selector: 'app-customer-home',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './home.html',
})
export class CustomerHome {
  private readonly authService = inject(SupabaseAuthService);
  private contentDbService = inject(ContentDbService);
  private sanitizer = inject(DomSanitizer);

  private toastService = inject(ToastService);

  public renderHtml = signal<SafeHtml | undefined>(undefined);
  public renderCss = signal<SafeHtml | undefined>(undefined);
  protected isAuthenticated = this.authService.isAuthenticated;

  async ngOnInit(): Promise<void> {
    const { data, error } = await this.contentDbService.getContentParaPublico();
    if (data) {
      const html = data.html_content;

      const css = data.css_content;
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
      this.renderCss.set(this.sanitizer.bypassSecurityTrustHtml(css));
      this.renderHtml.set(this.sanitizer.bypassSecurityTrustHtml(tempDiv.innerHTML));
    }
    if (error) {
      console.error('Error al cargar el contenido:', error);
      this.toastService.error('Error al cargar el contenido', 'Error al cargar el contenido');
    }
  }
}
