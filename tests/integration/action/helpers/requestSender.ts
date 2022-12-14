import * as supertest from 'supertest';
import { ActionFilter, ActionParams, UpdatableActionParams } from '../../../../src/action/models/action';

export class ActionRequestSender {
  public constructor(private readonly app: Express.Application) {}

  public async getActions(filter: ActionFilter = {}): Promise<supertest.Response> {
    return supertest.agent(this.app).get('/action').query(filter);
  }

  public async postAction(body: ActionParams): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/action').set('Content-Type', 'application/json').send(body);
  }

  public async patchAction(actionId: string, body: UpdatableActionParams): Promise<supertest.Response> {
    return supertest.agent(this.app).patch(`/action/${actionId}`).set('Content-Type', 'application/json').send(body);
  }
}
