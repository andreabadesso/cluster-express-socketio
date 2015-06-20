var express     = require('express'),
    cluster     = require('cluster'),
    net         = require('net'),
    sio         = require('socket.io'),
    sio_redis   = require('socket.io-redis'),
    redis       = require('redis'),
    http        = require('http'),
    _           = require('lodash');

var port = 3000,
    num_processes = require('os').cpus().length,
    connectedClients = [];

if (cluster.isMaster) {
    // This stores our workers. We need to keep them to be able to reference
    // them based on source IP address. It's also useful for auto-restart,
    // for example.
    var workers = [];

    // Helper function for spawning worker at index 'i'.
    var spawn = function(i) {
        workers[i] = cluster.fork();

        // Optional: Restart worker on exit
        workers[i].on('exit', function(worker, code, signal) {
            console.log('respawning worker', i);
            spawn(i);
        });
    };

    // Spawn workers.
    for (var i = 0; i < num_processes; i++) {
        spawn(i);
    }

    // Helper function for getting a worker index based on IP address.
    // This is a hot path so it should be really fast. The way it works
    // is by converting the IP address to a number by removing the dots,
    // then compressing it to the number of slots we have.
    //
    // Compared against "real" hashing (from the sticky-session code) and
    // "real" IP number conversion, this function is on par in terms of
    // worker index distribution only much faster.
    var worker_index = function(ip, len) {
        /*
         * Conexões localhost:
         */
        ip = ip.replace('::ffff:', '');
        if (ip === '::1') {
            ip = '127.0.0.1';
        }

        var s = '';
        for (var i = 0, _len = ip.length; i < _len; i++) {
            if (ip[i] !== '.') {
                s += ip[i];
            }
        }

        return Number(s) % len;
    };

    // Create the outside facing server listening on our port.
    var server = net.createServer({
        pauseOnConnect: true
    }, function(connection) {
        // We received a connection and need to pass it to the appropriate
        // worker. Get the worker for this connection's source IP and pass
        // it the connection.
        var worker = workers[worker_index(connection.remoteAddress, num_processes)];
        worker.send('sticky-session:connection', connection);
    }).listen(port);

} else {
    var app         = require('./lib/app');
    var redisClient = redis.createClient();
    var socketList = [];
    redisClient.subscribe('toclient');

    var server = http.createServer(app);
    var io = sio(server);

    var adapter = sio_redis({
        host: 'localhost',
        port: 6379
    });

    redisClient.on('message', function(channel, data) {
        var clients = [];
        var rooms = io.of('/');

        if (channel === 'toclient') {
            for (var id in rooms.connected) {
                var wat = rooms.connected[id];
                if (wat.handshake.query.token === data) {
                    clients.push(wat);
                }
            }

            clients.forEach(function(client) {
                client.emit('wat', 'aheuahue');
            });
        }
    });

    io.use(function(socket, next) {
        var clientId = socket.handshake.query.token;

        if (!clientId) {
            next(new Error('Not Authorized'));
        } else {
            socket.clientId = clientId;
            next();
        }
    });

    io.adapter(adapter);

    io.sockets
        .on('connection', function(socket) {
        });

    // Listen to messages sent from the master. Ignore everything else.
    process.on('message', function(message, connection) {
        if (message !== 'sticky-session:connection') {
            return;
        }

        // Emulate a connection event on the server by emitting the
        // event with the connection the master sent us.
        server.emit('connection', connection);

        connection.resume();
    });
}
