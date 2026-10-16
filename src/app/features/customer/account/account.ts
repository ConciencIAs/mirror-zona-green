import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { form, validateStandardSchema } from '@angular/forms/signals';

import { UserStore } from '@src/app/core/state/customer/customer.state';
import { CartStore } from '@src/app/core/state/card/card.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { SupabaseAuthService } from '@src/app/core/services/supabase/supabase-auth.service';
import { ToastService } from '@src/app/core/services/ui/toast.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { TipoDoc } from '@src/app/shared/models/interfaces/db/db';

import {
  profileUpdateSchema,
  ProfileUpdateData,
} from '@src/app/shared/models/schemas/profile.schema';

import { FormInputComponent } from '@src/app/shared/components/form/form-input/form-input';
import {
  FormSelectComponent,
  SelectOption,
} from '@src/app/shared/components/form/form-select/form-select';
import { FormDatepickerComponent } from '@src/app/shared/components/form/form-datepicker/form-datapicker';
import { CambiarContrasena } from './cambiar-contrasena/cambiar-contrasena';
import { fechaAISO, fechaDesdeISO } from '@src/app/shared/utils/fechas';
import {
  MENSAJE_CELULAR_EN_USO,
  MENSAJE_CELULAR_INVALIDO,
  esErrorCelularRepetido,
  normalizarCelular,
} from '@src/app/shared/utils/telefono';

@Component({
  selector: 'app-account',
  imports: [FormInputComponent, FormSelectComponent, FormDatepickerComponent, CambiarContrasena],
  templateUrl: './account.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class Account implements OnInit {
  private readonly userStore = inject(UserStore);
  private readonly cartStore = inject(CartStore);
  private readonly dbService = inject(SupabaseDbService);
  private readonly authService = inject(SupabaseAuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly copiedCode = signal(false);
  readonly signingOut = signal(false);

  /** Campo actualmente en edición (null = ninguno, todos mostrados como botones) */
  readonly editingField = signal<string | null>(null);

  toggleEdit(field: string): void {
    this.editingField.update((current) => (current === field ? null : field));
  }

  /** Etiqueta legible del tipo de documento seleccionado, para la vista de resumen */
  get tipoDocumentoLabel(): string {
    const value = this.formModel().tipo_documento;
    return this.documentTypeOptions.find((o) => o.value === value)?.label ?? value;
  }

  /** Fecha de nacimiento formateada, para la vista de resumen */
  readonly fechaNacimientoDisplay = computed(() => {
    const fecha = this.formModel().fecha_nacimiento;
    if (!fecha) return 'Sin definir';
    return new Date(fecha).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  /**
   * Aviso para completar el celular (Fase 2c): falta, no es un celular válido,
   * o se retiró porque coincidía con el de otra cuenta.
   */
  readonly avisoCelular = computed(() => {
    const perfil = this.userStore.perfil();
    const retirado = (perfil.datos_adicionales as Record<string, unknown> | null)?.['telefono_retirado_motivo'];
    if (!perfil.telefono && retirado) {
      return 'Tu celular coincidía con el de otra cuenta y lo retiramos. Escribe tu celular para seguir recibiendo avisos.';
    }
    if (!perfil.telefono) return 'Aún no tienes un celular registrado. Agrégalo para que podamos contactarte.';
    if (!normalizarCelular(perfil.telefono)) {
      return 'Tu celular no parece válido. Revísalo: colombiano de 10 dígitos o extranjero con indicativo (+).';
    }
    return null;
  });

  /** Código de invitación / referido propio del usuario */
  readonly codigoInvitacion = computed(() => this.userStore.perfil().codigo_invitacion);

  /** Opciones de tipo de documento */
  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CC', label: 'Cédula de ciudadanía (CC)' },
    { value: 'CE', label: 'Cédula de extranjería (CE)' },
    { value: 'NIT', label: 'NIT' },
    { value: 'Pasaporte', label: 'Pasaporte' },
  ];

  /** Datos de solo lectura del perfil (no editables) */
  readonly correo = computed(() => this.userStore.perfil().correo);
  readonly fullName = computed(() => this.userStore.perfil().full_name);
  readonly createdAt = computed(() => {
    const raw = this.userStore.perfil().created_at;
    if (!raw) return '—';
    return new Date(raw).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  /** Fecha máxima: hoy (no puede ser usuario del futuro) */
  readonly maxDate = new Date();

  /** Modelo del formulario: se inicializa en ngOnInit con los datos del store */
  readonly formModel = signal<ProfileUpdateData>({
    full_name: '',
    telefono: '',
    documento: '',
    tipo_documento: 'CC',
    fecha_nacimiento: new Date(),
    ubicacion: '',
  });

  /** Formulario reactivo de Angular Signals */
  readonly profileForm = form(this.formModel, (schemaPath) => {
    validateStandardSchema(schemaPath, profileUpdateSchema);
  });

  async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.authService.signOut();
      this.userStore.clearPerfil();
      this.cartStore.clearCart();
      this.router.navigate(['/']);
    } finally {
      this.signingOut.set(false);
    }
  }

  ngOnInit(): void {
    const perfil = this.userStore.perfil();

    // Fecha de calendario en hora local (antes se mostraba un día menos).
    const fechaNacimiento = fechaDesdeISO(perfil.fecha_nacimiento) ?? new Date();

    this.formModel.set({
      full_name: perfil.full_name ?? '',
      telefono: perfil.telefono ?? '',
      documento: perfil.documento ?? '',
      tipo_documento: (perfil.tipo_documento as TipoDoc) ?? 'CC',
      fecha_nacimiento: fechaNacimiento,
      ubicacion: perfil.ubicacion ?? '',
    });
  }

  /** Copiar código de referido al portapapeles */
  async copiarCodigo(): Promise<void> {
    const code = this.codigoInvitacion();
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      this.copiedCode.set(true);
      this.toastService.success('¡Código de referido copiado al portapapeles!');
      setTimeout(() => this.copiedCode.set(false), 2500);
    } catch {
      this.toastService.error('No se pudo copiar el código.');
    }
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();

    if (this.profileForm().invalid()) {
      this.profileForm().markAsTouched();
      this.toastService.error('Por favor corrige los errores del formulario antes de guardar.');
      return;
    }

    this.loading.set(true);

    try {
      const data = this.formModel();
      const userId = this.userStore.perfil().id;

      // Un celular por persona (Fase 2c): si cambió, no puede ser de otra cuenta.
      const celular = normalizarCelular(data.telefono);
      if (!celular) {
        this.toastService.error(MENSAJE_CELULAR_INVALIDO);
        return;
      }
      if (celular !== normalizarCelular(this.userStore.perfil().telefono)) {
        const estado = await this.dbService.estadoCelular(celular, userId);
        if (estado !== 'disponible') {
          this.toastService.error(estado === 'en_uso' ? MENSAJE_CELULAR_EN_USO : MENSAJE_CELULAR_INVALIDO);
          return;
        }
      }

      const payload: Record<string, unknown> = {
        full_name: data.full_name.trim(),
        telefono: celular,
        documento: data.documento.trim(),
        tipo_documento: data.tipo_documento,
        fecha_nacimiento: fechaAISO(data.fecha_nacimiento),
        ubicacion: data.ubicacion.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.dbService.update(TableName.PERFILES, payload, { id: userId });

      if (esErrorCelularRepetido(error)) {
        this.toastService.error(MENSAJE_CELULAR_EN_USO);
        return;
      }
      if (error) {
        this.toastService.error(
          'Error al actualizar el perfil: ' + (error as { message: string }).message,
        );
        return;
      }

      this.formModel.update((m) => ({ ...m, telefono: celular }));
      this.userStore.updatePerfil({
        full_name: data.full_name.trim(),
        telefono: celular,
        documento: data.documento.trim(),
        tipo_documento: data.tipo_documento as TipoDoc,
        fecha_nacimiento: fechaAISO(data.fecha_nacimiento),
        ubicacion: data.ubicacion.trim(),
        updated_at: new Date().toISOString(),
      });

      this.toastService.success('¡Perfil actualizado exitosamente!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar';
      this.toastService.error(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
