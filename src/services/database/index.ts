import { DatabaseAdapter } from './DatabaseAdapter';
import { LocalDbAdapter } from './LocalDbAdapter';
import { TauriDbAdapter } from './TauriDbAdapter';

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

class DatabaseService {
  private adapter: DatabaseAdapter;

  constructor() {
    if (isTauriEnvironment()) {
      this.adapter = new TauriDbAdapter();
    } else {
      this.adapter = new LocalDbAdapter();
    }
  }

  getAdapter(): DatabaseAdapter {
    return this.adapter;
  }
}

export const dbService = new DatabaseService();
export const db: DatabaseAdapter = dbService.getAdapter();
