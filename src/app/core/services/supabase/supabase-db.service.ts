import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';

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

  get tableNames() {
    return TableName;
  }
}
