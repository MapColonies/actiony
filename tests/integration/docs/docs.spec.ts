import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { BEFORE_ALL_TIMEOUT } from '../helpers';
import { DocsRequestSender } from './helpers/docsRequestSender';

describe('docs', function () {
  let requestSender: DocsRequestSender;

  beforeEach(async function () {
    const { app } = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new DocsRequestSender(app);
  }, BEFORE_ALL_TIMEOUT);

  describe('Happy Path', function () {
    it('should return 301 status code', async function () {
      const response = await requestSender.getDocs();

      expect(response.status).toBe(httpStatusCodes.MOVED_PERMANENTLY);
      expect(response.redirect).toBe(true);
      expect(response.type).toBe('text/html');
    });
  });
});
