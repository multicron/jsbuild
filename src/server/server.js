/*jslint bitwise: true, node: true, lastsemic: true */
'use strict';

const express = require('express');
const app = express();
const basic_auth = require('express-basic-auth');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const debug = require('debug')('splines');

debug("server.js starting up with NODE_PATH " + process.env.NODE_PATH );

const globals = require('globals.js');
const constant = require('constant.js');

const Player = require('Player.js');
const RobotPlayer = require('RobotPlayer.js');

const PlayerUpdate = require('PlayerUpdate.js');
const Leader = require('Leader.js');

const html = require("Phyper.js");

const NetworkMonitor = require("NetworkMonitor.js");

const Timer = require("Timer.js");

// Define "logger"
let logger = global.logger = function(...args) {debug(...args)};

//disable logging by uncommenting the next line
//logger = (() => {});

let auth = basic_auth({users: { 'user': 'password' }});
//app.use(auth);
app.use(express.static(__dirname + '/../client'));

let all_cells = [];
global.all_cells = all_cells;

let sockets = {};
let player_num = 1;

let server_status = {};
const netmon = new NetworkMonitor(status => {server_status.network = status});

let players = [];

const tick_timer = new Timer((timer) => {server_status.tick_game = `tick_game took ${timer.times.join(' ')}`},50);

function get_player_by_id(id) {
    return players.find(p => {return p.id == id});
}

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

    tick_timer.start();

    players.forEach(player => {
	player.update_viewport_scale();
	player.update_shade();
    });

    clear_all_cells();
    populate_all_cells();

    players.forEach(player => {
	if (player.alive) {
	    // This also updates all_cells with new head position,
	    // but doesn't remove old tail position
	    player.one_step();
	}
    });

    // Dashing players

    players.forEach(player => {
	if (player.dash && player.alive) {
	    // This also updates all_cells with new head position,
	    // but doesn't remove old tail position
	    player.one_step();
	}
    });

    // Dashing players at scale > 4.0

    players.forEach(player => {
	if (player.dash && player.scale > 4.0 && player.alive > 4.0) {
	    // This also updates all_cells with new head position,
	    // but doesn't remove old tail position
	    player.one_step();
	}
    });

    update_clients();

    remove_dead_players();

    while (players.length < globals.minplayers) {
	let player = add_robot();
	logger("Sending s_update_one_player");
	broadcast('s_update_one_player',player);
    }
    server_status.num_players = `Number Players (server): ${players.length}`;

    tick_timer.end();
}

function volatile_broadcast(name,data) {
//    logger("io.sockets","broadcast",name,"bytes: ",JSON.stringify(data).length);
    io.sockets.volatile.emit(name,data);
}

function broadcast(name,data) {
//    logger("io.sockets","broadcast",name,"bytes: ",JSON.stringify(data).length);
    io.sockets.emit(name,data);
}

function player_in_client_viewport(player,client) {

    let client_min_x = (client.position.x - client.scale*globals.view_dim.width/2) - 1;
    let client_min_y = (client.position.y - client.scale*globals.view_dim.height/2) - 1;

    let client_max_x = client_min_x + (client.scale*globals.view_dim.width/2) + 1;
    let client_max_y = client_min_y + (client.scale*globals.view_dim.height/2) + 1;

    logger(`Client can clip out anything not in ${client_min_x},${client_min_y},${client_max_x},${client_max_y}`);

    let player_max_x = 0;
    let player_max_y = 0;
    let player_min_x = globals.view_dim.width;
    let player_min_y = globals.view_dim.height;

    player.cells.map(cell => {
	if (cell.x < player_min_x) { player_min_x = cell.x }
	if (cell.y < player_min_y) { player_min_y = cell.y }
	if (cell.x > player_max_x) { player_max_x = cell.x }
	if (cell.y > player_max_y) { player_max_y = cell.y }
    });

    if (client_min_x > player_max_x) { return false } // Client is offscreen to the right
    if (client_max_x < player_min_x) { return false } // Client is offscreen to the left
    if (client_min_y > player_max_y) { return false } // Client is offscreen to the bottom
    if (client_max_y < player_min_y) { return false } // Client is offscreen to the top
    
    return true;
}

function update_clients() {
    let updates = [];

    players.forEach(player => {
	updates.push(new PlayerUpdate(player,2));
    });

    broadcast('s_update_client',updates);

}

function filtered_update_clients() {

    let clients = players.filter(player => sockets[player.id]);

    clients.forEach(client => {
	let updates = [];
	players.forEach(player => {
	    if (player_in_client_viewport(player,client)) {
		logger(`Pushing update for client ${client.name}, player ${player.name}`);
		updates.push(new PlayerUpdate(player,2));
	    }
	});
	let socket = sockets[client.id];
	socket.emit('s_update_client',updates);
    });
}

function send_server_status() {
    logger(server_status);
    broadcast('s_server_status',server_status);
}

function update_leaderboard(p) {
    let leaders = [];

    for (let i=0; i<players.length; i++) {
	leaders[i] = new Leader(players[i]);
    }

    leaders.sort(function (a,b) {
	return b.score - a.score;
    });

    if (leaders.length > 8) {
	leaders.length = 8;
    }

    if (leaders.filter(function (a) {return a.id===p.id}).length <= 0) {
	leaders[8] = new Leader(p);
    }

    return leaders;
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

    if (0) {
	(function () {
    	    let emit = socket.emit;
            let onevent = socket.onevent;

    	    socket.emit = function () {
    		logger('socket.io', 'emit bytes:', arguments[0], JSON.stringify(arguments[1]).length);
		emit.apply(socket, arguments);
    	    };
    	    socket.onevent = function (packet) {
		logger('socket.io', 'on bytes:', JSON.stringify(packet).length, packet);
		//		logger('socket.io', 'on', Array.prototype.slice.call(packet.data || []));
		onevent.apply(socket, arguments);
    	    };
	}());
    }
    
    let type = socket.handshake.query.type;

    // Initialize new player

    let connected_player = new Player();

    connected_player.name = "Player " + (player_num++);
    connected_player.id = socket.id;
    connected_player.is_robot = false;
    sockets[connected_player.id] = socket;
    players.push(connected_player);
    logger('Player ' + connected_player.id + ' connecting!');

    // Send a world update to the new player
    socket.emit('s_update_world',players);

    // Tell all the other players about this player
    broadcast('s_update_one_player',connected_player);

    socket.on('c_latency', function (startTime, cb) {
	cb(startTime);
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

    socket.on('c_request_world_update', function () {
        logger('c_request_world_update from ' + connected_player.id);
	socket.emit('s_update_world',players);
    });

    socket.on('c_request_leaderboard', function () {
        logger('c_request_leaderboard from ' + connected_player.id);
	socket.emit('s_update_leaderboard',update_leaderboard(connected_player));
    });

    socket.on('c_log', function (data) {
	logger("c_log: ",data);
    });

    socket.on('disconnect', function () {
	logger("Got disconnect");
        logger('User ' + connected_player.id + ' disconnected!');
       socket.broadcast.emit('s_player_disc', connected_player);
    });

    socket.on('c_request_update_one_player', function (player_id) {
        logger(`c_request_update_one_player for connected player ${connected_player.id} updating player id ${player_id}`);
	let player_to_send = get_player_by_id(player_id);
	socket.emit('s_update_clients',player_to_send);
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


// Don't touch, IP configurations.
let ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || globals.host;
let serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || globals.port;
http.listen( serverport, ipaddress, function() {
    logger('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
