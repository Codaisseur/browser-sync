"use strict";

var socket = require("socket.io");
var utils = require("./server/utils");

/**
 * Plugin interface
 * @returns {*|function(this:exports)}
 */
module.exports.plugin = function(server, clientEvents, bs) {
    return exports.init(server, clientEvents, bs);
};

/**
 * @param {http.Server} server
 * @param clientEvents
 * @param {BrowserSync} bs
 */
module.exports.init = function(server, clientEvents, bs) {
    var emitter = bs.events;

    var socketConfig = bs.options.get("socket").toJS();

    if (
        bs.options.get("mode") === "proxy" &&
        bs.options.getIn(["proxy", "ws"])
    ) {
        server = utils.getServer(null, bs.options).server;
        server.listen(bs.options.getIn(["socket", "port"]));
        bs.registerCleanupTask(function() {
            server.close();
        });
    }

    var socketIoConfig = socketConfig.socketIoOptions;
    socketIoConfig.path = socketConfig.path;

    var io = socket(server, socketIoConfig);

    // Override default namespace.
    io.sockets = io.of(socketConfig.namespace);

    io.set("heartbeat interval", socketConfig.clients.heartbeatTimeout);

    /**
     * Listen for new connections
     */
    io.sockets.on("connection", handleConnection);

    /**
     * Handle each new connection
     * @param {Object} client
     */
    function handleConnection(client) {
        // set ghostmode callbacks
        if (bs.options.get("ghostMode")) {
            addGhostMode(client);
        }

        client.emit("connection", bs.options.toJS()); //todo - trim the amount of options sent to clients

        emitter.emit("client:connected", client)
        client.on('disconnect', function(){
          emitter.emit("client:disconnected", client)
        })
    }

    /**
     * @param client
     */
    function addGhostMode(client) {
        clientEvents.forEach(addEvent);

        function addEvent(event) {
            client.on(event, (data) => {
                client.broadcast.emit(event, data);
            });
        }
    }

    return io;
};
