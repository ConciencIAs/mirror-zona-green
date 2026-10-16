import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import { EstadoCelular, normalizarCelular } from '@src/app/shared/utils/telefono';

@Injectable({ providedIn: 'root' })
export class SupabaseDbService {
  private readonly supabaseClient = inject(SupabaseClientService);

  from(table: TableName) {
    return this.supabaseClient.supabase.from(table);
  }

  select(table: TableName, columns = '*') {
    return this.from(table).select(columns);
  }

  insert(table: TableName, values: Record<string, unknown> | Record<string, unknown>[]) {
    return this.from(table).insert(values);
  }

  update(table: TableName, values: Record<string, unknown>, match: Record<string, unknown>) {
    return this.from(table).update(values).match(match);
  }

  delete(table: TableName, match: Record<string, unknown>) {
    return this.from(table).delete().match(match);
  }

  rpc(fnName: string, params?: Record<string, unknown>) {
    return this.supabaseClient.supabase.rpc(fnName, params);
  }

  /**
   * Indica si existe una cuenta con ese correo, sin exponer ningún otro dato.
   * Usa la RPC `existe_correo`; si todavía no está creada en la base
   * (migración 20261015120000 sin aplicar), cae a la consulta anterior sobre
   * usuarios_publicos para que el login siga funcionando durante el despliegue.
   */
  async existeCorreo(correo: string): Promise<boolean> {
    const correoNormalizado = correo.trim().toLowerCase();
    const { data, error } = await this.rpc('existe_correo', { p_correo: correoNormalizado });
    if (!error) return data === true;

    const { data: fila, error: errorTabla } = await this.from(TableName.USUARIOS_PUBLICOS)
      .select('correo')
      .eq('correo', correoNormalizado)
      .maybeSingle();
    if (errorTabla) throw errorTabla;
    return !!fila;
  }

  /**
   * 'invalido' | 'en_uso' | 'disponible' para un celular, sin revelar de quién
   * es. `excluirPerfilId` permite que un usuario conserve su propio número.
   * Si la RPC aún no existe en la base (migración 20261016130000 sin aplicar),
   * solo se valida el formato y se deja la decisión al guardar.
   */
  async estadoCelular(telefono: string, excluirPerfilId?: string): Promise<EstadoCelular> {
    const { data, error } = await this.rpc('estado_telefono', {
      p_telefono: telefono,
      p_excluir: excluirPerfilId ?? null,
    });
    if (!error && (data === 'invalido' || data === 'en_uso' || data === 'disponible')) return data;
    return normalizarCelular(telefono) ? 'disponible' : 'invalido';
  }

  get tableNames() {
    return TableName;
  }
}
