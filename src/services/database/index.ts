import { DatabaseAdapter } from './DatabaseAdapter';
import { TauriDbAdapter } from './TauriDbAdapter';

const dbService = new TauriDbAdapter();

export const db: DatabaseAdapter = dbService;
