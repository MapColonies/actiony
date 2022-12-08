import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { DependencyContainer } from 'tsyringe';
import { QueryFailedError } from 'typeorm';
import { faker } from '@faker-js/faker';
import { ActionRepository, ACTION_REPOSITORY_SYMBOL } from '../../../src/action/DAL/typeorm/actionRepository';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { BEFORE_ALL_TIMEOUT, LONG_RUNNING_TEST_TIMEOUT } from '../helpers';
import { Action, ActionFilter, ActionParams, ActionStatus, Sort, UpdatableActionParams } from '../../../src/action/models/action';
import { ActionRequestSender } from './helpers/requestSender';
import { generateActionParams, sortByDate, stringifyAction, stringifyActions } from './helpers';

let depContainer: DependencyContainer;
const queryFailureMock = jest.fn().mockRejectedValue(new QueryFailedError('select *', [], new Error('failed')));

describe('action', function () {
  let requestSender: ActionRequestSender;
  let actionRepository: ActionRepository;

  beforeAll(async function () {
    const { app, container } = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });

    depContainer = container;
    const repository = depContainer.resolve<ActionRepository>(ACTION_REPOSITORY_SYMBOL);
    actionRepository = repository;
    requestSender = new ActionRequestSender(app);
  }, BEFORE_ALL_TIMEOUT);

  beforeEach(async function () {
    await actionRepository.clear();
  });

  describe('Happy Path', function () {
    describe('GET /action', function () {
      it('should return 200 for an empty filter and return an empty actions response', async function () {
        const response = await requestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject([]);
      });

      it('should return 200 for an empty filter and return the existing actions', async function () {
        const params = generateActionParams();
        const action = await actionRepository.save(params);

        const response = await requestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject([stringifyAction(action)]);
      });

      it('should return 200 and only the actions matching service filter', async function () {
        const params1 = generateActionParams();
        const params2 = generateActionParams();
        const actions = await actionRepository.save([params1, params2]);
        const expected = actions.filter((a) => a.service === params1.service);

        const response = await requestSender.getActions({ service: params1.service });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching status filter', async function () {
        const filteredStatus = ActionStatus.FAILED;
        const params1 = generateActionParams({ status: filteredStatus });
        const params2 = generateActionParams();

        const actions = await actionRepository.save([params1, params2]);
        const expected = actions.filter((a) => a.status === filteredStatus);

        const response = await requestSender.getActions({ status: [filteredStatus] });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching multiple statuses filter', async function () {
        const params1 = generateActionParams({ status: ActionStatus.COMPLETED });
        const params2 = generateActionParams({ status: ActionStatus.FAILED });
        const params3 = generateActionParams();
        const filteredStatuses = [ActionStatus.COMPLETED, ActionStatus.FAILED];

        const actions = await actionRepository.save([params1, params2, params3]);
        const expected = actions.filter((a) => filteredStatuses.includes(a.status));

        const response = await requestSender.getActions({ status: filteredStatuses });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only the actions matching service and status filter', async function () {
        const filteredStatus = ActionStatus.COMPLETED;
        const filter: ActionFilter = { service: 'someService', status: [filteredStatus] };

        const params1 = generateActionParams({ service: filter.service, status: filteredStatus });
        const params2 = generateActionParams({ service: filter.service, status: ActionStatus.FAILED });
        const params3 = generateActionParams({ status: filteredStatus });

        const actions = await actionRepository.save([params1, params2, params3]);
        const expected = actions.filter((a) => a.service === filter.service && a.status === filteredStatus);

        const response = await requestSender.getActions(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and only limited amount of actions according to filter', async function () {
        const params1 = generateActionParams();
        const params2 = generateActionParams();
        const params3 = generateActionParams();
        await actionRepository.save([params1, params2, params3]);

        const response = await requestSender.getActions({ limit: 2 });

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toHaveLength(2);
      });

      it('should return 200 and ordered actions by creation time according to default', async function () {
        const params1 = generateActionParams();
        const params2 = generateActionParams();
        const params3 = generateActionParams();
        const res1 = await actionRepository.save(params1);
        const res2 = await actionRepository.save(params2);
        const res3 = await actionRepository.save(params3);
        const expected = sortByDate([res1, res2, res3], 'updatedAt', 'desc');

        const response = await requestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and ordered actions by creation time asc or desc accordingly', async function () {
        const params1 = generateActionParams();
        const params2 = generateActionParams();
        const params3 = generateActionParams();
        const res1 = await actionRepository.save(params1);
        const res2 = await actionRepository.save(params2);
        const res3 = await actionRepository.save(params3);

        const expectedAsc = sortByDate([res1, res2, res3], 'updatedAt', 'asc');
        const responseAsc = await requestSender.getActions({ sort: 'asc' });
        expect(responseAsc.status).toBe(httpStatusCodes.OK);
        expect(responseAsc.body).toMatchObject(stringifyActions(expectedAsc));

        const expectedDesc = sortByDate([res1, res2, res3], 'updatedAt', 'desc');
        const responseDesc = await requestSender.getActions({ sort: 'desc' });
        expect(responseDesc.status).toBe(httpStatusCodes.OK);
        expect(responseDesc.body).toMatchObject(stringifyActions(expectedDesc));
      });

      it('should return 200 and ordered actions by creation time desc which is the default sort', async function () {
        const params1 = generateActionParams();
        const params2 = generateActionParams();
        const params3 = generateActionParams();
        const res1 = await actionRepository.save(params1);
        const res2 = await actionRepository.save(params2);
        const res3 = await actionRepository.save(params3);
        const expected = sortByDate([res1, res2, res3], 'updatedAt', 'desc');

        const response = await requestSender.getActions();

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions(expected));
      });

      it('should return 200 and filtered actions by multi param filter', async function () {
        const filteredStatus = ActionStatus.COMPLETED;
        const filter: ActionFilter = { service: 'someService', status: [filteredStatus], sort: 'asc', limit: 2 };
        const params1 = generateActionParams({ service: filter.service, status: filteredStatus });
        const params2 = generateActionParams({ service: filter.service, status: ActionStatus.FAILED });
        const params3 = generateActionParams({ status: filteredStatus });
        const params4 = generateActionParams({ service: filter.service, status: filteredStatus });
        const params5 = generateActionParams({ service: filter.service, status: filteredStatus });

        const res1 = await actionRepository.save(params1);
        await actionRepository.save([params2, params3]);
        const res4 = await actionRepository.save(params4);
        const res5 = await actionRepository.save(params5);
        const expected = sortByDate([res1, res4, res5], 'updatedAt', 'asc');

        const response = await requestSender.getActions(filter);

        expect(response.status).toBe(httpStatusCodes.OK);
        expect(response.body).toMatchObject(stringifyActions([expected[0], expected[1]]));
      });
    });

    describe('POST /action', function () {
      it('should return 201 and the created action id', async function () {
        const params = generateActionParams();

        const response = await requestSender.postAction(params);

        expect(response.status).toBe(httpStatusCodes.CREATED);
        expect(response.body).toHaveProperty('actionId');
      });
    });

    describe('PATCH /action/{actionId}', function () {
      it('should return 200 and update the relevant action status', async function () {
        const params = generateActionParams();
        const postActionRes = await requestSender.postAction(params);
        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        // validate the action status is active
        let action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);

        const response = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(response.status).toBe(httpStatusCodes.OK);

        // validate the action status is completed
        action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.COMPLETED);
      });

      it('should return 200 and update the relevant action status and metadata', async function () {
        const createdMetadata = { k1: 'v1', k2: 'v2' };
        const patchedMetadata = { k1: 'patched', k3: 'added' };
        const params = generateActionParams({ metadata: createdMetadata });
        const postActionRes = await requestSender.postAction(params);
        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        // validate the action metadata is createdMetadata
        let action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);
        expect(action).toHaveProperty('metadata', createdMetadata);

        const response = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED, metadata: patchedMetadata });
        expect(response.status).toBe(httpStatusCodes.OK);

        // validate the action metadata is patchedMetadata
        action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.COMPLETED);
        expect(action).toHaveProperty('metadata', patchedMetadata);
      });
    });

    describe('FLOW', function () {
      it('should post get and patch an action through its lifecycle', async function () {
        const params = generateActionParams();
        const postResponse = await requestSender.postAction(params);
        expect(postResponse.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postResponse.body as { actionId: string }).actionId;

        // validate the action status is active and closedAt is null
        let getResponse = await requestSender.getActions({ service: params.service, status: [ActionStatus.ACTIVE] });
        expect(getResponse.status).toBe(httpStatusCodes.OK);
        expect(getResponse.body).toHaveLength(1);
        let action = (getResponse.body as Action[])[0];
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);
        expect(action).toHaveProperty('closedAt', null);

        // complete the action
        const patchRes = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(patchRes.status).toBe(httpStatusCodes.OK);

        // validate the action status has been patched
        getResponse = await requestSender.getActions({ service: params.service, status: [ActionStatus.ACTIVE] });
        expect(getResponse.status).toBe(httpStatusCodes.OK);
        expect(getResponse.body).toMatchObject([]);

        // validate the action status is completed and closedAt equals to updatedAt
        getResponse = await requestSender.getActions({ service: params.service, status: [ActionStatus.COMPLETED] });
        expect(getResponse.status).toBe(httpStatusCodes.OK);
        expect(getResponse.body).toHaveLength(1);
        action = (getResponse.body as Action[])[0];
        expect(action).toHaveProperty('status', ActionStatus.COMPLETED);
        expect(action).toHaveProperty('closedAt', action.updatedAt);

        // validate another patch will fail
        const conflictingPatchRes = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(conflictingPatchRes.status).toBe(httpStatusCodes.CONFLICT);
        expect(conflictingPatchRes.body).toHaveProperty('message', `action ${actionId} has already been closed with status completed`);
      });
    });
  });

  describe('Bad Path', function () {
    describe('GET /action', function () {
      it('should return 400 for a filter with non positive integer limit', async function () {
        const response = await requestSender.getActions({ limit: -1 });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.query.limit should be >= 1');
      });

      it('should return 400 for a filter with bad sort', async function () {
        const response = await requestSender.getActions({ sort: 'badSort' as Sort });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.query.sort should be equal to one of the allowed values: asc, desc');
      });

      it('should return 400 for a filter with additional properties', async function () {
        const response = await requestSender.getActions({ property: 'value' } as ActionFilter);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "Unknown query parameter 'property'");
      });

      it('should return 400 for a filter with empty service', async function () {
        const response = await requestSender.getActions({ service: '' });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "Empty value found for query parameter 'service'");
      });

      it('should return 400 for a filter with bad status', async function () {
        const response = await requestSender.getActions({ status: ['badStatus' as ActionStatus] });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          'request.query.status[0] should be equal to one of the allowed values: active, completed, failed, canceled'
        );
      });
    });

    describe('POST /action', function () {
      it('should return 400 if the request body is missing service', async function () {
        const params = generateActionParams();
        const { service, ...restOfParams } = params;

        const response = await requestSender.postAction(restOfParams as ActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request.body should have required property 'service'");
      });

      it('should return 400 if the request body is missing state', async function () {
        const params = generateActionParams();
        const { state, ...restOfParams } = params;

        const response = await requestSender.postAction(restOfParams as ActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', "request.body should have required property 'state'");
      });

      it('should return 400 if the request body has additional properties', async function () {
        const params = generateActionParams();

        const response = await requestSender.postAction({ ...params, additionalProperty: 'value' } as ActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body should NOT have additional properties');
      });

      it('should return 400 if the request body has an invalid metadata', async function () {
        const params = generateActionParams();

        const response = await requestSender.postAction({ ...params, metadata: 1 as unknown as Record<string, unknown> } as ActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body.metadata should be object');
      });

      it('should return 409 if the requesting service is not recognized by the registry', async function () {
        const params = generateActionParams({ service: 'badService' });

        const response = await requestSender.postAction(params);

        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', 'could not recognize service badService on registry');
      });
    });

    describe('PATCH /action/{actionId}', function () {
      it('should return 400 if the request body has an invalid status', async function () {
        const params = generateActionParams();

        const postActionRes = await requestSender.postAction(params);

        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        const response = await requestSender.patchAction(actionId, { status: 'badStatus' as ActionStatus });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty(
          'message',
          'request.body.status should be equal to one of the allowed values: active, completed, failed, canceled'
        );
      });

      it('should return 400 if the request body has an invalid metadata', async function () {
        const params = generateActionParams();

        const postActionRes = await requestSender.postAction(params);

        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        const response = await requestSender.patchAction(actionId, { metadata: 1 as unknown as Record<string, unknown> });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body.metadata should be object');
      });

      it('should return 400 if the request body has additional properties', async function () {
        const params = generateActionParams();

        const postActionRes = await requestSender.postAction(params);

        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        const response = await requestSender.patchAction(actionId, {
          status: ActionStatus.ACTIVE,
          metadata: { k: 'v' },
          additionalProperty: '1',
        } as UpdatableActionParams);

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body should NOT have additional properties');
      });

      it('should return 400 if the request body is empty', async function () {
        const params = generateActionParams();

        const postActionRes = await requestSender.postAction(params);

        expect(postActionRes.status).toBe(httpStatusCodes.CREATED);
        const actionId = (postActionRes.body as { actionId: string }).actionId;

        const response = await requestSender.patchAction(actionId, {});

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.body should NOT have fewer than 1 properties');
      });

      it('should return 400 if the actionId param invalid', async function () {
        const { status, metadata } = generateActionParams();
        const response = await requestSender.patchAction('badActionId', { status, metadata });

        expect(response.status).toBe(httpStatusCodes.BAD_REQUEST);
        expect(response.body).toHaveProperty('message', 'request.params.actionId should match format "uuid"');
      });

      it('should return 404 if the patched action does not exist', async function () {
        const uuid = faker.datatype.uuid();
        const { status, metadata } = generateActionParams();
        const response = await requestSender.patchAction(uuid, { status, metadata });

        expect(response.status).toBe(httpStatusCodes.NOT_FOUND);
        expect(response.body).toHaveProperty('message', `actionId ${uuid} not found`);
      });

      it('should return 409 if the patched action has already been closed', async function () {
        const closingStatus = ActionStatus.COMPLETED;
        const params = generateActionParams();
        let response = await requestSender.postAction(params);
        expect(response.status).toBe(httpStatusCodes.CREATED);
        const actionId = (response.body as { actionId: string }).actionId;

        // validate the action status is active
        const action = await actionRepository.findOneBy({ actionId });
        expect(action).toHaveProperty('status', ActionStatus.ACTIVE);

        // first patch should succeed
        response = await requestSender.patchAction(actionId, { status: closingStatus });
        expect(response.status).toBe(httpStatusCodes.OK);

        // second patch should conflict
        response = await requestSender.patchAction(actionId, { status: ActionStatus.COMPLETED });
        expect(response.status).toBe(httpStatusCodes.CONFLICT);
        expect(response.body).toHaveProperty('message', `action ${actionId} has already been closed with status ${closingStatus}`);
      });
    });
  });

  describe('Sad Path', function () {
    describe('GET /action', function () {
      it(
        'should return 500 if the db throws an error',
        async function () {
          const { app } = await getApp({
            override: [
              { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
              { token: ACTION_REPOSITORY_SYMBOL, provider: { useValue: { findActions: queryFailureMock } } },
            ],
          });
          const mockActionRequestSender = new ActionRequestSender(app);

          const response = await mockActionRequestSender.getActions();

          expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
          expect(response.body).toHaveProperty('message', 'failed');
        },
        LONG_RUNNING_TEST_TIMEOUT
      );
    });

    describe('POST /action', function () {
      it(
        'should return 500 if the db throws an error',
        async function () {
          const { app } = await getApp({
            override: [
              { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
              { token: ACTION_REPOSITORY_SYMBOL, provider: { useValue: { createAction: queryFailureMock } } },
            ],
          });
          const mockActionRequestSender = new ActionRequestSender(app);

          const params = generateActionParams();
          const response = await mockActionRequestSender.postAction(params);

          expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
          expect(response.body).toHaveProperty('message', 'failed');
        },
        LONG_RUNNING_TEST_TIMEOUT
      );
    });

    describe('PATCH /action/{actionId}', function () {
      it(
        'should return 500 if the db throws an error',
        async function () {
          const { app } = await getApp({
            override: [
              { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
              {
                token: ACTION_REPOSITORY_SYMBOL,
                provider: {
                  useValue: { findOneActionById: jest.fn().mockResolvedValue({ status: ActionStatus.ACTIVE }), updateOneAction: queryFailureMock },
                },
              },
            ],
          });
          const mockActionRequestSender = new ActionRequestSender(app);

          const response = await mockActionRequestSender.patchAction(faker.datatype.uuid(), { status: ActionStatus.ACTIVE });

          expect(response.status).toBe(httpStatusCodes.INTERNAL_SERVER_ERROR);
          expect(response.body).toHaveProperty('message', 'failed');
        },
        LONG_RUNNING_TEST_TIMEOUT
      );
    });
  });
});
