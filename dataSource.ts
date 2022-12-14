import config from 'config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './src/common/db';
import { DbConfig } from './src/common/interfaces';

const dbConfig = config.get<DbConfig>('db');

export const appDataSource = new DataSource({
  ...createDataSourceOptions(dbConfig),
  migrationsTableName: 'migrations_table',
  migrations: ['db/migrations/*.ts'],
});
