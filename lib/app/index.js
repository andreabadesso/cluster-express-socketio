'use strict';

var express             = require('express');

var app = module.exports = express();

app.all('*', function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    next();
});

app.set('json spaces', 0);
app.set('port', process.env.PORT || 3000);
app.use(express.static('lib/static'));

var emitter = require('socket.io-emitter')({
    host: 'localhost',
    port: 6379
});

var adapter = require('socket.io-redis')({
    host: 'localhost',
    port: 6379
});

app.get('/test', function(req, res, next) {

    console.log(adapter);

/*    var matchingClients = connectedClients.filter(function(client) {
        return client.clientId = 'ahuhuauhAAHuhAUh';
    });
*/

    emitter.emit('messages', {
        message: 'wat'
    });

    res.send({
        clients: []
    });
});

/*
 * Error Handler
 */
function errorHandler(err, req, res, next) {

    var status  = err.status || 500,
        message = err.message || 'Ocorreu um erro';

    if (err && err.log) {
        console.log(err.log)
    }

    res.status(status);

    res.send({
        message: message,
        status: status
    });

    next();
}

//app.use(errorHandler);
