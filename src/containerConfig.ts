import config from 'config';
import { getOtelMixin } from '@map-colonies/telemetry';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { DataSource } from 'typeorm';
import { trace } from '@opentelemetry/api';
import { instancePerContainerCachingFactory, DependencyContainer } from 'tsyringe';
import { HealthCheck } from '@godaddy/terminus';
import { CleanupRegistry } from '@map-colonies/cleanup-registry';
import { dataSourceFactory, DATA_SOURCE_PROVIDER, getDbHealthCheckFunction } from './common/db';
import { tracing } from './common/tracing';
import { HEALTHCHECK, ON_SIGNAL, SERVICES, SERVICE_NAME } from './common/constants';
import { actionRouterFactory, ACTION_ROUTER_SYMBOL } from './action/routes/actionRouter';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { actionRepositoryFactory, ACTION_REPOSITORY_SYMBOL } from './action/DAL/typeorm/actionRepository';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = async (options?: RegisterOptions): Promise<DependencyContainer> => {
  const cleanupRegistry = new CleanupRegistry();

  try {
    const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
    const logger = jsLogger({ ...loggerConfig, mixin: getOtelMixin() });

    cleanupRegistry.on('itemFailed', (id, error, msg) => logger.error({ msg, itemId: id, err: error }));
    cleanupRegistry.on('finished', (status) => logger.info({ msg: `cleanup registry finished cleanup`, status }));

    cleanupRegistry.register({ func: tracing.stop.bind(tracing), id: SERVICES.TRACER });
    const tracer = trace.getTracer(SERVICE_NAME);

    const dependencies: InjectionObject<unknown>[] = [
      { token: SERVICES.CONFIG, provider: { useValue: config } },
      { token: SERVICES.LOGGER, provider: { useValue: logger } },
      { token: SERVICES.TRACER, provider: { useValue: tracer } },
      { token: ACTION_ROUTER_SYMBOL, provider: { useFactory: actionRouterFactory } },
      {
        token: DATA_SOURCE_PROVIDER,
        provider: { useFactory: instancePerContainerCachingFactory(dataSourceFactory) },
        postInjectionHook: async (deps: DependencyContainer): Promise<void> => {
          const dataSource = deps.resolve<DataSource>(DATA_SOURCE_PROVIDER);
          cleanupRegistry.register({ func: dataSource.destroy.bind(dataSource), id: DATA_SOURCE_PROVIDER });
          await dataSource.initialize();
        },
      },
      { token: ACTION_REPOSITORY_SYMBOL, provider: { useFactory: actionRepositoryFactory } },
      {
        token: HEALTHCHECK,
        provider: {
          useFactory: (container): HealthCheck => {
            const dataSource = container.resolve<DataSource>(DATA_SOURCE_PROVIDER);
            return getDbHealthCheckFunction(dataSource);
          },
        },
      },
      {
        token: ON_SIGNAL,
        provider: {
          useValue: cleanupRegistry.trigger.bind(cleanupRegistry),
        },
      },
    ];

    const container = await registerDependencies(dependencies, options?.override, options?.useChild);
    return container;
  } catch (error) {
    await cleanupRegistry.trigger();
    throw error;
  }
};
