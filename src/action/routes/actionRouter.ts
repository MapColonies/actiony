import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { ActionController } from '../controllers/actionController';

export const ACTION_ROUTER_SYMBOL = Symbol('actionRouterFactory');

export const actionRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(ActionController);

  router.get('/', controller.getActions);
  router.post('/', controller.postAction);
  router.patch('/:actionId', controller.patchAction);

  return router;
};
