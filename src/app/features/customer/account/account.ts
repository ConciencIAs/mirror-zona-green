import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { form, validateStandardSchema } from '@angular/forms/signals';

import { UserStore } from '@src/app/core/state/customer/customer.state';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
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

@Component({
  selector: 'app-account',
  imports: [FormInputComponent, FormSelectComponent, FormDatepickerComponent],
  templateUrl: './account.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: ``,
})
export class Account implements OnInit {
  private readonly userStore = inject(UserStore);
  private readonly dbService = inject(SupabaseDbService);
  private readonly toastService = inject(ToastService);

  readonly loading = signal(false);

  /** Opciones de tipo de documento */
  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CC', label: 'Cédula de ciudadanía (CC)' },
    { value: 'CE', label: 'Cédula de extranjería (CE)' },
    { value: 'NIT', label: 'NIT' },
    { value: 'Pasaporte', label: 'Pasaporte' },
  ];

  /** Datos de solo lectura del perfil (no editables) */
  readonly correo = computed(() => this.userStore.perfil().correo);
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

  ngOnInit(): void {
    const perfil = this.userStore.perfil();

    // Construimos la fecha de nacimiento: si existe en DB la parseamos, sino hoy
    let fechaNacimiento: Date;
    if (perfil.fecha_nacimiento) {
      const parsed = new Date(perfil.fecha_nacimiento);
      fechaNacimiento = isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      fechaNacimiento = new Date();
    }

    // Cargamos los datos del store en el modelo del formulario
    this.formModel.set({
      full_name: perfil.full_name ?? '',
      telefono: perfil.telefono ?? '',
      documento: perfil.documento ?? '',
      tipo_documento: (perfil.tipo_documento as TipoDoc) ?? 'CC',
      fecha_nacimiento: fechaNacimiento,
      ubicacion: perfil.ubicacion ?? '',
    });
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();

    if (this.profileForm().invalid()) {
      this.toastService.error('Por favor corrige los errores del formulario antes de guardar.');
      return;
    }

    this.loading.set(true);

    try {
      const data = this.formModel();
      const userId = this.userStore.perfil().id;

      // Convertimos fecha_nacimiento a string ISO para Supabase
      const payload: Record<string, unknown> = {
        full_name: data.full_name.trim(),
        telefono: data.telefono.trim(),
        documento: data.documento.trim(),
        tipo_documento: data.tipo_documento,
        fecha_nacimiento: data.fecha_nacimiento.toISOString().split('T')[0],
        ubicacion: data.ubicacion.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.dbService.update(TableName.PERFILES, payload, { id: userId });

      if (error) {
        this.toastService.error(
          'Error al actualizar el perfil: ' + (error as { message: string }).message,
        );
        return;
      }

      // Actualizamos el store local con los nuevos datos
      this.userStore.updatePerfil({
        full_name: data.full_name.trim(),
        telefono: data.telefono.trim(),
        documento: data.documento.trim(),
        tipo_documento: data.tipo_documento as TipoDoc,
        fecha_nacimiento: data.fecha_nacimiento.toISOString().split('T')[0],
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
