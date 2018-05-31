/*jslint bitwise: true, node: true, lastsemic: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const debug = require('debug')('blubio');

debug("server.js starting up with NODE_PATH " + process.env.NODE_PATH );

const globals = require('globals.js');
const constant = require('constant.js');

const Player = require('Player.js');
const RobotPlayer = require('RobotPlayer.js');
const PlayerUpdate = require('PlayerUpdate.js');
const Phyper = require("Phyper.js");
const NetworkMonitor = require("NetworkMonitor.js");
const Timer = require("Timer.js");

let logger = function(...args) {
    debug(...args);
};

//logger = (() => {});

app.use(express.static(__dirname + '/../client'));

let all_cells = [];
global.all_cells = all_cells;

let sockets = {};
let immortal_socket;
let player_num = 1;

let server_status = {};
const netmon = new NetworkMonitor(status => {server_status.network = status});

let players = [];
let food = [];

function add_robot() {
    let player = new RobotPlayer();
    players.push(player);
    return player;
}

function populate_all_cells(p) {
    let count = 0;

    for (let i=0 ; i<players.length; i++) {
	let p = players[i];
	if (p.alive) {
	    for (let j = 0; j< p.cells.length; j++) {
		all_cells[p.cells[j].x][p.cells[j].y] = p;
		count++;
	    }
	}
    }
    server_status.cell_count = `Total Cells: ${count}`;
}

function remove_dead_players() {
    let i = players.length;
    while (i--) {
	if (!players[i].alive) {
	    players.splice(i, 1);
	} 
    }
}

function tick_game() {

    let timer = new Timer((time) => {server_status.tick_game = `tick_game took ${time} ms.`});

    clear_all_cells();

    players.forEach(player => {
	player.update_viewport_scale();
	player.update_shade();
    });

    populate_all_cells();

    players.forEach(player => {
	if (player.alive) {
	    player.one_step();
	    populate_all_cells();
	    if (player.dash) {
		player.one_step();
		populate_all_cells();
	    }
	}
    });

    update_clients();

    remove_dead_players();

    while (players.length < globals.minplayers) {
	let player = add_robot();
	logger("Sending s_add_player");
	io.sockets.emit('s_add_player',player);
    }
    server_status.num_players = `Number Players (server): ${players.length}`;

    timer.end();
}

function update_clients() {
    let updates = [];

    players.forEach(player => {
	updates.push(new PlayerUpdate(player,3));
    });

    updates.forEach(update => {
    	let player_socket = sockets[update.id];
    	if (player_socket) {
    	    player_socket.emit('s_update_client',updates);
    	}
    });

}

function send_server_status() {
    logger(server_status);
    io.sockets.emit('s_server_status',server_status);
}

function init_all_cells() {
    for (let i=0;i<globals.world_dim.width;i++) {
	all_cells[i]=[];
	for (let j=0;j<globals.world_dim.height;j++) {
	    all_cells[i][j]=0;
	}
    }
}

function clear_all_cells() {
    for (let i=0;i<globals.world_dim.width;i++) {
	for (let j=0;j<globals.world_dim.height;j++) {
	    all_cells[i][j]=0;
	}
    }
}

io.on('connect', function (socket) {
    logger('A user connected!', socket.handshake);

    let type = socket.handshake.query.type;

    // Initialize new player

    let connected_player = new Player();
    connected_player.name = "Player " + (player_num++);
    connected_player.id = socket.id;
    connected_player.is_robot = false;
    sockets[connected_player.id] = socket;
    players.push(connected_player);
    logger('Player ' + connected_player.id + ' connecting!');

    socket.emit('s_update_world',players);

    immortal_socket = socket;

    if (0) {
	(function () {
    	    let emit = socket.emit,
            onevent = socket.onevent;
	    
    	    socket.emit = function () {
    		logger('socket.io', 'emit', arguments[0], arguments[1]);
		emit.apply(socket, arguments);
    	    };
    	    socket.onevent = function (packet) {
		logger('socket.io', 'on', Array.prototype.slice.call(packet.data || []));
		onevent.apply(socket, arguments);
    	    };
	}());
    }
	
    socket.on('c_latency', function (startTime, cb) {
	cb(startTime);
    }); 

    socket.on('c_timestamp', function (clientTime) {
//	logger("Client time lag = ",Date.now() - clientTime);
    }); 

    socket.on('c_change_direction', function (new_dir) {
        logger('c_change_direction ' + connected_player.id + ' changing direction to ',new_dir);

	let old_dir = connected_player.dir;

	if (old_dir == new_dir) {
	    // Do nothing
	}
	else if ((old_dir!=constant.direction.left && old_dir!=constant.direction.right) && (new_dir==constant.direction.left || new_dir==constant.direction.right)) {
            logger('Changing direction to vertical',new_dir);
	    connected_player.dir = new_dir;
	}
	else if ((old_dir!=constant.direction.up && old_dir!=constant.direction.down) && (new_dir==constant.direction.up || new_dir==constant.direction.down)) {
            logger('Changing direction to horizontal',new_dir);
	    connected_player.dir = new_dir;
	}
    });

    socket.on('c_change_dash', function (dash) {
	connected_player.dash = dash;
    });

    socket.on('c_request_player_update', function () {
        // logger('c_request_update_clients from ' + connected_player.id);
	// socket.emit('s_update_clients',players);
	// logger("Sent requested s_update_clients to ",connected_player.id);
    });

    socket.on('c_request_world_update', function () {
        logger('c_request_world_update from ' + connected_player.id);
	socket.emit('s_update_world',players);
    });

    socket.on('c_log', function (data) {
	logger("Client says: ",data);
    });

    socket.on('disconnect', function () {
	logger("Got disconnect");
        logger('User ' + connected_player.id + ' disconnected!');
       socket.broadcast.emit('s_player_disc', connected_player);
    });

});

function init_game() {

    logger("init_game");
    // Initialize "all cells" array for collision detection

    init_all_cells();

    // Add initial players to the players[] array

    for (let x=0;x<globals.startplayers;x++) {
	add_robot();
    }
}

init_game();

setInterval(tick_game,80);
setInterval(() => {netmon.run()},1000);
setInterval(send_server_status,1000);
//setInterval(log_status,5000);


// Don't touch, IP configurations.
let ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || globals.host;
let serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || globals.port;
http.listen( serverport, ipaddress, function() {
    logger('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
