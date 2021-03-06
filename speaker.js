'use strict';

const _ = require('lodash');
const Guid = require('shimo-guid');
const Redis = require('ioredis');
const Promise = require('bluebird');
const debug = require('debug')('speaker');

class Speaker {
  constructor(options) {
    options = options || {};
    _.assign(this, _.defaults(options, {
      speakerChannel: 'REDIS_SPEAKER',
      listenerChannel: 'REDIS_LISTENER',
      timeout: 5000
    }));

    if (!this.subClient) {
      this.subClient = new Redis(options.redis);
    }

    if (!this.pubClient) {
      this.pubClient = new Redis(options.redis);
    }

    this.processGuid = Guid.new(16);
    this.dataPool = {};

    if (options.autoConnect) {
      this.subscribe();
    }
  }

  subscribe() {
    const promise = this.subClient.subscribe(this.listenerChannel);

    this.subClient.on('message', (channel, data) => {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return;
      }

      debug('speaker GET listener', channel, this.listenerChannel, data, this.processGuid);

      if (channel !== this.listenerChannel) {
        return;
      }

      if (data.processGuid !== this.processGuid) {
        return;
      }

      if (!data.speakerGuid) {
        debug('speakerGuid required');
        return;
      }

      if (!this.dataPool[data.speakerGuid]) {
        debug('No such speakerGuid');
        return;
      }

      const current = this.dataPool[data.speakerGuid];

      current.result.push(data.message);
      current.getMount.then(mount => {
        debug('now', data.speakerGuid, 'length is', current.result.length, 'mount is', mount);
        if (current.result.length === mount) {
          current.deferred.resolve(current.result);
        }
      });
    });

    return promise;
  }

  send(type, message) {
    if (arguments.length === 1) {
      message = type;
      type = 'general';
    }

    const speakerGuid = Guid.new(16);
    const current = this.dataPool[speakerGuid] = {
      startTime: Date.now(),
      result: []
    };

    const promise = new Promise((_resolve, _reject) => {
      const done = _.bind(function () {
        clearTimeout(current.timeout);
        current.endTime = Date.now();
        debug('speaker', speakerGuid, 'expires', current.endTime - current.startTime);
        delete this.dataPool[speakerGuid];
      }, this);

      const resolve = function () {
        _resolve.apply(this, arguments);
        done();
      };

      const reject = function () {
        _reject.apply(this, arguments);
        done();
      };

      current.getMount = this.pubClient.publish(
        this.speakerChannel, JSON.stringify({
          speakerGuid,
          type,
          message,
          processGuid: this.processGuid
        })
      );

      current.getMount.then(mount => {
        if (mount === 0) {
          reject([]);
        }

        current.timeout = setTimeout(function () {
          const receivedCount = current.result.length;
          if (receivedCount === 0) {
            reject(new Error('Redisspeaker timeout'));
          }
          if (receivedCount > 0 && receivedCount < mount) {
            debug('Incomplete result');
            resolve(current.result);
          }
        }, this.timeout);
        current.deferred = {resolve, reject, promise};
      });
    });

    return promise;
  }
}

module.exports = Speaker;
