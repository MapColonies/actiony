import { Logger } from '@map-colonies/js-logger';
import { inject, injectable } from 'tsyringe';
import { SERVICES } from '../../common/constants';
import { ACTION_IDENTIFIER_COLUMN } from '../DAL/typeorm/action';
import { ActionRepository, ACTION_CLOSED_STATUSES, ACTION_REPOSITORY_SYMBOL } from '../DAL/typeorm/actionRepository';
import { Action, ActionFilter, ActionParams, ActionStatus, Parallelism, UpdatableActionParams } from './action';
import { ActionAlreadyClosedError, ActionNotFoundError, ParallelismMismatchError } from './errors';
import { getServiceFromRegistryMock, Service } from './registryMock';
import { parallelismToMaxActive, stringifyRotation } from './util';

@injectable()
export class ActionManager {
  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(ACTION_REPOSITORY_SYMBOL) private readonly actionRepository: ActionRepository
  ) {}

  public async getActions(filter: ActionFilter): Promise<Action[]> {
    this.logger.info({ msg: 'getting actions matching the following filter', filter });

    return this.actionRepository.findActions(filter);
  }

  public async createAction(params: ActionParams): Promise<string> {
    const serviceId = params.service;

    this.logger.info({ msg: 'fetching service from registry', serviceId });

    const service = await getServiceFromRegistryMock(serviceId);

    this.logger.info({ msg: "validating service's action parallelism", service });

    if (service.parallelism === Parallelism.SINGLE || service.parallelism === Parallelism.REPLACEABLE) {
      await this.validateParallelism(service);
    }

    this.logger.info({ msg: 'attempting to create action with the following params', params, ...service });

    let actionId: string;

    const actionParams = { ...params, rotation: stringifyRotation(service.serviceRotation, service.parentRotation) };

    if (service.parallelism === Parallelism.SINGLE || service.parallelism === Parallelism.MULTIPLE) {
      const creationResult = await this.actionRepository.createAction(actionParams);
      actionId = creationResult.identifiers[0][ACTION_IDENTIFIER_COLUMN] as string;
    } else {
      const creationResult = await this.actionRepository.updateLastAndCreate(
        { status: ActionStatus.CANCELED, metadata: { closingReason: 'canceled by parallelism rules' } },
        actionParams
      );
      actionId = creationResult.identifiers[0][ACTION_IDENTIFIER_COLUMN] as string;
    }

    this.logger.info({ msg: 'created action', actionId });

    return actionId;
  }

  public async updateAction(actionId: string, updateParams: UpdatableActionParams): Promise<void> {
    const action = await this.actionRepository.findOneActionById(actionId);

    if (action === null) {
      this.logger.error({ msg: 'action not found for update', actionId });
      throw new ActionNotFoundError(`actionId ${actionId} not found`);
    }

    if (ACTION_CLOSED_STATUSES.includes(action.status)) {
      this.logger.error({ msg: 'action has already been closed', actionId, actionStatus: action.status });
      throw new ActionAlreadyClosedError(`action ${actionId} has already been closed with status ${action.status}`);
    }

    this.logger.info({ msg: 'updating action with the follwing params', actionId, params: updateParams });

    await this.actionRepository.updateOneAction(actionId, updateParams);
  }

  private async validateParallelism(service: Service): Promise<unknown> {
    const maxActiveActionsAllowed = parallelismToMaxActive(service.parallelism);
    const activeActions = await this.getActions({ service: service.serviceId, status: [ActionStatus.ACTIVE], limit: maxActiveActionsAllowed + 1 });

    if (activeActions.length > maxActiveActionsAllowed) {
      this.logger.error({ msg: 'service parallelism mismatch', ...service, activeActions });
      throw new ParallelismMismatchError(`service ${service.serviceId} has mismatched parallelism`);
    }

    return activeActions;
  }
}
