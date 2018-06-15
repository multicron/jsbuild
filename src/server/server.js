/*jslint bitwise: true, node: true, lastsemic: true */
'use strict';

const express = require('express');
const app = express();
const basic_auth = require('express-basic-auth');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const debug = require('debug')('splines');
const debug_socket = require('debug')('splines:socket');

debug("server.js starting up with NODE_PATH " + process.env.NODE_PATH );

const globals = require('globals.js');
const constant = require('constant.js');

const Pager = require("Pager.js");

const Player = require('Player.js');
const RobotPlayer = require('RobotPlayer.js');

const PlayerUpdate = require('PlayerUpdate.js');
const Leader = require('Leader.js');

const PowerUp = require('PowerUp.js');

const html = require("Phyper.js");

const NetworkMonitor = require("NetworkMonitor.js");

const Timer = require("Timer.js");

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
let powerups = [];

const tick_timer = new Timer((timer) => {server_status.tick_game = `tick_game took ${timer.times.join(' ')}`},50);

function get_player_by_id(id) {
    return players.find(p => {return p.id == id});
}

function add_robot() {
    let player = new RobotPlayer();
    players.push(player);
    return player;
}

function add_powerup() {
    let powerup = new PowerUp();
    powerups.push(powerup);
    return powerup;
}

function populate_all_cells() {
    let count = 0;
    let count2 = 0;

    for (let i=0 ; i<players.length; i++) {
	let p = players[i];
	if (p.alive) {
	    for (let j = 0; j< p.cells.length; j++) {
		all_cells[p.cells[j].x][p.cells[j].y] = p;
		count++;
	    }
	}
    }
    
    powerups.forEach((powerup) => {all_cells[powerup.position.x][powerup.position.y] = powerup; count2++;});

    server_status.cell_count = `Total Cells: ${count} Total Power Ups: ${count2}`;
}

function remove_dead_players() {
    let i = players.length;
    while (i--) {
	if (!players[i].alive) {
	    players.splice(i, 1);
	} 
    }
}

function remove_dead_powerups() {
    let i = powerups.length;
    while (i--) {
	if (!powerups[i].alive) {
	    powerups.splice(i, 1);
	} 
    }
}

function expire_player_powerups() {
    players.forEach((player) => {
	let powerups = player.powerups;
	let i = powerups.length;
	while (i--) {
	    if (powerups[i].start_time + powerups[i].duration < Date.now()) {
		powerups.splice(i, 1);
	    } 
	}
    });
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
	    player.one_step();
	}
    });

    // Dashing players

    players.forEach(player => {
	if (player.dash && player.alive) {
	    player.one_step();
	}
    });

    // Dashing players at scale > 4.0

    players.forEach(player => {
    	if (player.dash && player.alive && player.scale > 4.0) {
    	    player.one_step();
    	}
    });

    update_clients();

    remove_dead_players();
    remove_dead_powerups();
    expire_player_powerups();

    while (players.length < globals.minplayers) {
	let player = add_robot();
	debug_socket("Sending s_update_one_player");
	broadcast('s_update_one_player',player);
    }
    server_status.num_players = `Number Players (server): ${players.length} Connected sockets: ${Object.keys(sockets).filter((k) => sockets[k].connected).length}`;

    while (powerups.length < globals.minpowerups) {
    	let powerup = add_powerup();
    }
    
    broadcast('s_update_powerups',powerups);
    debug_socket("Sending s_update_powerups");

    tick_timer.end();
}

function volatile_broadcast(name,data) {
//    debug_socket("io.sockets","broadcast",name,"bytes: ",JSON.stringify(data).length);
    io.sockets.volatile.emit(name,data);
}

function broadcast(name,data) {
//    debug_socket("io.sockets","broadcast",name,"bytes: ",JSON.stringify(data).length);
    io.sockets.emit(name,data);
}

function player_in_client_viewport(player,client) {

    let client_min_x = (client.position.x - client.scale*globals.view_dim.width/2) - 1;
    let client_min_y = (client.position.y - client.scale*globals.view_dim.height/2) - 1;

    let client_max_x = client_min_x + (client.scale*globals.view_dim.width/2) + 1;
    let client_max_y = client_min_y + (client.scale*globals.view_dim.height/2) + 1;

    debug(`Client can clip out anything not in ${client_min_x},${client_min_y},${client_max_x},${client_max_y}`);

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
	updates.push(new PlayerUpdate(player,3));
    });

    broadcast('s_update_client',updates);
    broadcast('s_update_powerups',powerups);

}

function filtered_update_clients() {

    let clients = players.filter(player => sockets[player.id]);

    clients.forEach(client => {
	let updates = [];
	players.forEach(player => {
	    if (player_in_client_viewport(player,client)) {
		debug(`Pushing update for client ${client.name}, player ${player.name}`);
		updates.push(new PlayerUpdate(player,2));
	    }
	});
	let socket = sockets[client.id];
	socket.emit('s_update_client',updates);
    });
}

function send_server_status() {
    debug_socket(server_status);
    broadcast('s_server_status',server_status);
}

function update_leaderboard(p) {
    let leaders = [];

    for (let i=0; i<players.length; i++) {
	if (players[i].alive) leaders[i] = new Leader(players[i]);
    }

    leaders.sort(function (a,b) {
	return b.score - a.score;
    });

    if (leaders.length > 8) {
	leaders.length = 8;
    }

    // Add the player's own score if not already on the board

    if (p.alive && leaders.filter(function (a) {return a.id===p.id}).length <= 0) {
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

function add_newly_connected_player(socket) {
    // Initialize new player
    
    let player_name = socket.handshake.query.name || "Player " + (player_num++);

    let new_player = new Player();
    
    new_player.name = player_name;
    new_player.id = socket.id;
    new_player.is_robot = false;
    sockets[new_player.id] = socket;
    players.push(new_player);
    debug('Player ' + new_player.id + ' connecting!');
    
    // Send a world update to the new player
    socket.emit('s_update_world',players);
    
    // Tell all the other players about this player
    broadcast('s_update_one_player',new_player);

    // if (player_name !== "Bluby") {
    // 	new Pager().send(`Player ${player_name} has started playing.`);
    // }

    return new_player;
}

function patch_socket_io(socket) {
    (function () {
    	let emit = socket.emit;
        let onevent = socket.onevent;
	
    	socket.emit = function () {
    	    debug_socket('socket.io', 'emit bytes:', arguments[0], JSON.stringify(arguments[1]).length);
	    emit.apply(socket, arguments);
    	};
    	socket.onevent = function (packet) {
	    debug_socket('socket.io', 'on bytes:', JSON.stringify(packet).length, packet);
	    //		debug_socket('socket.io', 'on', Array.prototype.slice.call(packet.data || []));
	    onevent.apply(socket, arguments);
    	};
    }());
}

io.on('connect', function (socket) {
    let connected_player;

    // Not yet used
    let type = socket.handshake.query.type;

    debug('A user connected!', socket.handshake);

    connected_player = add_newly_connected_player(socket);

    debug(`Connected Player ${connected_player.id}`);

    socket.on('c_latency', function (startTime, cb) {
	cb(startTime);
    }); 

    socket.on('c_change_direction', function (new_dir) {
        debug_socket('c_change_direction ' + connected_player.id + ' changing direction to ',new_dir);

	let old_dir = connected_player.dir;

	if (old_dir == new_dir) {
	    // Do nothing
	}
	else if ((old_dir!=constant.direction.left && old_dir!=constant.direction.right) && (new_dir==constant.direction.left || new_dir==constant.direction.right)) {
            debug('Changing direction to vertical',new_dir);
	    connected_player.dir = new_dir;
	}
	else if ((old_dir!=constant.direction.up && old_dir!=constant.direction.down) && (new_dir==constant.direction.up || new_dir==constant.direction.down)) {
            debug('Changing direction to horizontal',new_dir);
	    connected_player.dir = new_dir;
	}
    });

    // socket.on('c_new_player', function (dash) {
    // 	connected_player = add_newly_connected_player(socket);
    // });

    socket.on('c_change_dash', function (dash) {
	connected_player.dash = dash;
    });

    socket.on('c_set_player_name', function (name) {
	connected_player.name = name;
    });

    socket.on('c_request_world_update', function () {
        debug_socket('c_request_world_update from ' + connected_player.id);
	socket.emit('s_update_world',players);
    });

    socket.on('c_request_leaderboard', function () {
        debug_socket('c_request_leaderboard from ' + connected_player.id);
	socket.emit('s_update_leaderboard',update_leaderboard(connected_player));
    });

    socket.on('c_log', function (data) {
	debug_socket("c_log: ",data);
    });

    socket.on('disconnect', function () {
	debug("Got disconnect");
        debug('User ' + connected_player.id + ' disconnected!');
       socket.broadcast.emit('s_player_disc', connected_player);
    });

    socket.on('c_request_update_one_player', function (player_id) {
        debug_socket(`c_request_update_one_player for connected player ${connected_player.id} updating player id ${player_id}`);
	let player_to_send = get_player_by_id(player_id);
	socket.emit('s_update_clients',player_to_send);
    });

});

function init_game() {

    debug("init_game");
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
    debug('Server on ' + ipaddress + ':' + serverport);
});
