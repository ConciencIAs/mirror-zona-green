import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { ContentDbService } from '@src/app/core/services/supabase/dynamic-content/content-db-page.service';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';

@Component({
  selector: 'app-dynamic-page',
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './dynamic-page.html',
})
export class DynamicPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(SupabaseAuthService);
  private readonly contentDbService = inject(ContentDbService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toastService = inject(ToastService);

  public renderHtml = signal<SafeHtml | undefined>(undefined);
  public renderCss = signal<SafeHtml | undefined>(undefined);
  public loading = signal<boolean>(true);
  public notFound = signal<boolean>(false);

  protected isAuthenticated = this.authService.isAuthenticated;

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe(async (params) => {
      const slug = params['slug'];
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
    this.renderCss.set(undefined);

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

      this.renderCss.set(this.sanitizer.bypassSecurityTrustHtml(css));
      this.renderHtml.set(this.sanitizer.bypassSecurityTrustHtml(tempDiv.innerHTML));
    } catch (err) {
      console.error('Unexpected error loading page content:', err);
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
