import expect from 'expect.js';
import sinon from 'sinon';
import fs from 'fs';
import rimraf from 'rimraf';

import { cleanPrevious, cleanError } from '../cleanup';
import Logger from '../../lib/logger';

describe('kibana cli', function () {

  describe('plugin installer', function () {

    describe('pluginCleaner', function () {
      const settings = {
        workingPath: 'dummy'
      };

      describe('cleanPrevious', function () {
        let cleaner;
        let errorStub;
        let logger;
        let progress;
        let request;

        beforeEach(function () {
          errorStub = sinon.stub();
          logger = new Logger(settings);
          sinon.stub(logger, 'log');
          sinon.stub(logger, 'error');
          request = {
            abort: sinon.stub(),
            emit: sinon.stub()
          };
        });

        afterEach(function () {
          logger.log.restore();
          logger.error.restore();
          fs.statSync.restore();
          rimraf.sync.restore();
        });

        it('should resolve if the working path does not exist', function () {
          sinon.stub(rimraf, 'sync');
          sinon.stub(fs, 'statSync', function () {
            const error = new Error('ENOENT');
            error.code = 'ENOENT';
            throw error;
          });

          return cleanPrevious(settings, logger)
          .catch(errorStub)
          .then(function (data) {
            expect(errorStub.called).to.be(false);
          });
        });

        it('should rethrow any exception except ENOENT from fs.statSync', function () {
          sinon.stub(rimraf, 'sync');
          sinon.stub(fs, 'statSync', function () {
            const error = new Error('An Unhandled Error');
            throw error;
          });

          errorStub = sinon.stub();
          return cleanPrevious(settings, logger)
          .catch(errorStub)
          .then(function () {
            expect(errorStub.called).to.be(true);
          });
        });

        it('should log a message if there was a working directory', function () {
          sinon.stub(rimraf, 'sync');
          sinon.stub(fs, 'statSync');

          return cleanPrevious(settings, logger)
          .catch(errorStub)
          .then(function (data) {
            expect(logger.log.calledWith('Found previous install attempt. Deleting...')).to.be(true);
          });
        });

        it('should rethrow any exception from rimraf.sync', function () {
          sinon.stub(fs, 'statSync');
          sinon.stub(rimraf, 'sync', function () {
            throw new Error('I am an error thrown by rimraf');
          });

          errorStub = sinon.stub();
          return cleanPrevious(settings, logger)
          .catch(errorStub)
          .then(function () {
            expect(errorStub.called).to.be(true);
          });
        });

        it('should resolve if the working path is deleted', function () {
          sinon.stub(rimraf, 'sync');
          sinon.stub(fs, 'statSync');

          return cleanPrevious(settings, logger)
          .catch(errorStub)
          .then(function (data) {
            expect(errorStub.called).to.be(false);
          });
        });

      });

      describe('cleanError', function () {
        let logger;

        beforeEach(function () {
          logger = new Logger(settings);
        });

        afterEach(function () {
          rimraf.sync.restore();
        });

        it('should attempt to delete the working directory', function () {
          sinon.stub(rimraf, 'sync');

          cleanError(settings);
          expect(rimraf.sync.calledWith(settings.workingPath)).to.be(true);
        });

        it('should swallow any errors thrown by rimraf.sync', function () {
          sinon.stub(rimraf, 'sync', function () {
            throw new Error('Something bad happened.');
          });

          expect(cleanError).withArgs(settings).to.not.throwError();
        });

      });

    });

  });

});
