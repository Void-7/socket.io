
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var sio = require('socket.io')
  , should = require('./common')
  , HTTPClient = should.HTTPClient
  , parser = sio.parser
  , ports = 15300;

/**
 * HTTPClient for htmlfile transport.
 */

function HTMLFile (port) {
  HTTPClient.call(this, port);
};

/**
 * Inhertis from HTTPClient.
 */

HTMLFile.prototype.__proto__ = HTTPClient.prototype;

/**
 * Override GET request with streaming parser.
 *
 * @api public
 */

var head = '<script>_('
  , foot = ');</script>'
  , initial = '<html><body>'
      + '<script>var _ = function (msg) { parent.s._(msg, document); };</script>'
      + new Array(174).join(' ')

HTMLFile.prototype.data = function (path, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts.buffer = false;

  return this.request(path, opts, function (res) {
    var buf = ''
      , state = 0;

    res.on('data', function (chunk) {
      buf += chunk;

      function parse () {
        switch (state) {
          case 0:
            if (buf.indexOf(initial) === 0) {
              buf = buf.substr(initial.length);
              state = 1;
            } else {
              break;
            }

          case 1:
            if (buf.indexOf(head) === 0) {
              buf = buf.substr(head.length);
              state = 2;
            } else {
              break;
            }

          case 2:
            if (buf.indexOf(foot) != -1) {
              var data = buf.slice(0, buf.indexOf(foot))
                , obj = JSON.parse(data);

              fn(obj === '' ? obj : parser.decodePayload(obj));

              buf = buf.substr(data.length + foot.length);
              state = 1;

              parse();
            }
        };
      };

      parse();
    });
  });
};

/**
 * Create client for this transport.
 *
 * @api public
 */

function client (port) {
  return new HTMLFile(port);
};

/**
 * Tests.
 */

module.exports = {

  'test that not responding to a heartbeat drops client': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , beat = false;

    io.configure(function () {
      io.set('heartbeat interval', .05);
      io.set('heartbeat timeout', .05);
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function (reason) {
        beat.should.be.true;
        reason.should.eql('heartbeat timeout');

        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs) {
        msgs.should.have.length(1);
        msgs[0].type.should.eql('heartbeat');
        beat = true;
      });
    });
  },

  'test that responding to a heartbeat maintains session': function (done) {
    var port = ++ports
      , cl = client(port)
      , io = create(cl)
      , beat = false;

    io.configure(function () {
      io.set('heartbeat interval', .05);
      io.set('heartbeat timeout', .05);
      io.set('close timeout', 0);
    });

    io.sockets.on('connection', function (socket) {
      socket.on('disconnect', function (reason) {
        beat.should.be.true;
        reason.should.eql('heartbeat timeout');

        cl.end();
        io.server.close();
        done();
      });
    });

    cl.handshake(function (sid) {
      var heartbeats = 0;

      cl.data('/socket.io/{protocol}/htmlfile/' + sid, function (msgs) {
        heartbeats++;

        if (heartbeats == 1) {
          cl.post('/socket.io/{protocol}/htmlfile/' + sid, parser.encodePacket({
            type: 'heartbeat'
          }));
        }

        if (heartbeats == 2) {
          beat = true;
        }
      });
    });
  }

};