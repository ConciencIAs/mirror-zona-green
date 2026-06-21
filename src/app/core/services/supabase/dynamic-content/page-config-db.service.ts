import { Injectable, inject } from '@angular/core';
import { SupabaseDbService } from '@src/app/core/services/supabase/supabase-db.service';
import { TableName } from '@src/app/shared/models/constans/db/tableName.enum';
import {
  ConfigName,
  NavbarConfig,
  FooterConfig,
  SettingsConfig,
  AdvertisingBannerConfig,
} from '@src/app/shared/models/interfaces/page-config.interface';

type ConfigTypes = NavbarConfig | FooterConfig | SettingsConfig | AdvertisingBannerConfig;

@Injectable({
  providedIn: 'root'
})
export class PageConfigDbService {
  private supabase = inject(SupabaseDbService);

  /**
   * Get configuration by config_name
   * @param configName - Type of configuration: 'navbar' | 'footer' | 'settings' | 'advertising_banner'
   */
  async getConfigByName<T extends ConfigTypes>(configName: ConfigName) {
    return await this.supabase
      .from(TableName.PAGE_CONFIG)
      .select('*')
      .eq('config_name', configName)
      .maybeSingle();
  }

  /**
   * Save/update configuration by config_name (upsert)
   * @param configName - Type of configuration
   * @param content - Configuration content
   */
  async saveConfigByName<T extends ConfigTypes>(configName: ConfigName, content: T) {
    return await this.supabase
      .from(TableName.PAGE_CONFIG)
      .upsert({ config_name: configName, content }, { onConflict: 'config_name' })
      .select()
      .single();
  }

}
