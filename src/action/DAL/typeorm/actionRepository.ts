import { DataSource, EntityManager, FindOptionsWhere, In, InsertResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { FactoryFunction } from 'tsyringe';
import { DATA_SOURCE_PROVIDER } from '../../../common/db';
import { Action, ActionFilter, ActionParams, ActionStatus, UpdatableActionParams } from '../../models/action';
import { Action as ActionEntity, ACTION_IDENTIFIER_COLUMN } from './action';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createActionRepository = (dataSource: DataSource) => {
  return dataSource.getRepository(ActionEntity).extend({
    async findActions(filter: ActionFilter, transactionManager?: EntityManager): Promise<ActionEntity[]> {
      const scopedManager = transactionManager ?? this.manager;

      const options: FindOptionsWhere<ActionEntity> = {};
      if (filter.service !== undefined) {
        options.service = filter.service;
      }

      if (filter.rotation !== undefined) {
        options.rotation = filter.rotation;
      }

      if (filter.status !== undefined) {
        options.status = In(filter.status);
      }

      return scopedManager.find(ActionEntity, { where: options, order: { createdAt: filter.sort }, take: filter.limit });
    },
    async findOneActionById(actionId: string, transactionManager?: EntityManager): Promise<Action | null> {
      const scopedManager = transactionManager ?? this.manager;
      return scopedManager.findOneBy(ActionEntity, { actionId });
    },
    async createAction(params: ActionParams & { rotation: string }, transactionManager?: EntityManager): Promise<InsertResult> {
      const scopedManager = transactionManager ?? this.manager;
      return scopedManager.createQueryBuilder().insert().into(ActionEntity).values(params).returning([ACTION_IDENTIFIER_COLUMN]).execute();
    },
    async updateOneAction(actionId: string, updateParams: UpdatableActionParams, transactionManager?: EntityManager): Promise<void> {
      const scopedManager = transactionManager ?? this.manager;

      let finalParams: QueryDeepPartialEntity<Action> = updateParams;

      if (updateParams.status !== undefined && ACTION_CLOSED_STATUSES.includes(updateParams.status)) {
        finalParams = {
          ...updateParams,
          closedAt: () => 'CURRENT_TIMESTAMP',
        };
      }

      await scopedManager.createQueryBuilder(ActionEntity, 'action').update(finalParams).where({ actionId }).execute();
    },
    async updateLastAndCreate(updateParams: UpdatableActionParams, params: ActionParams & { rotation: string }): Promise<InsertResult> {
      return this.manager.connection.transaction(async (entityManager) => {
        const actions = await this.findActions({ service: params.service, status: [ActionStatus.ACTIVE], sort: 'desc', limit: 1 }, entityManager);

        if (actions.length !== 0) {
          const action = actions[0];
          const updatedMetadata = { ...action.metadata, ...updateParams.metadata };
          await this.updateOneAction(action.actionId, { ...updateParams, metadata: updatedMetadata }, entityManager);
        }

        return this.createAction(params, entityManager);
      });
    },
  });
};

export const ACTION_CLOSED_STATUSES = [ActionStatus.COMPLETED, ActionStatus.FAILED, ActionStatus.CANCELED];

export const ACTION_REPOSITORY_SYMBOL = Symbol('actionRepository');

export type ActionRepository = ReturnType<typeof createActionRepository>;

export const actionRepositoryFactory: FactoryFunction<ActionRepository> = (depContainer) => {
  const dataSource = depContainer.resolve<DataSource>(DATA_SOURCE_PROVIDER);
  return createActionRepository(dataSource);
};
