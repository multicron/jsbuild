/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var debug = require('debug')('blubio');

var global = require('lib/global.js');
const constant = require('lib/constant.js');
const Player = require('lib/Player.js');

var logger = function(...args) {
    debug(...args);
};

logger("server.js starting up");

app.use(express.static(__dirname + '/../client'));

var all_cells = [];
var users = [];
var sockets = {};
var immortal_socket;

var players = [];
var food = [];
var robot_counter = 0;

function add_player() {
    var player = new Player();
    player.id = "R"+robot_counter++;
    player.is_robot = true;
    players.push(player);
}

function init_game() {

    logger("init_game");
    // Initialize "all cells" array for collision detection

    for (var i=0;i<global.world_dim.width;i++) {
	all_cells[i]=[];
	for (var j=0;j<global.world_dim.height;j++) {
	    all_cells[i][j]=0;
	}
    }

    // Add initial players to the players[] array

    for (var x=0;x<global.startplayers;x++) {
	add_player();
    }
}

function update_viewport_scale(p) {
    p.scale = 1 + Math.min(2,(p.cells.length / 1000));
}

function populate_all_cells(p) {
    for (let i = 0; i< p.cells.length; i++) {
	all_cells[p.cells[i].x][p.cells[i].y] = p;
    }
}

function award_collision(killed,killer) {
    killer.size += Math.floor(killed.cells.length/2);
    killed.size = 1;
}

function remove_dead_players() {
    var i = players.length;
    while (i--) {
	if (!players[i].alive) {
	    players.splice(i, 1);
	} 
    }
}

function turn_right(dir) {
    switch (dir) {
    case constant.direction.up: 
	return constant.direction.right;
    case constant.direction.left: 
	return constant.direction.up;
    case constant.direction.down: 
	return constant.direction.left;
    case constant.direction.right: 
	return constant.direction.down;
    }
    return constant.direction.stopped;
}

function turn_left(dir) {
    switch (dir) {
    case constant.direction.up: 
	return constant.direction.left;
    case constant.direction.left: 
	return constant.direction.down;
    case constant.direction.down: 
	return constant.direction.right;
    case constant.direction.right: 
	return constant.direction.up;
    }
    return constant.direction.stopped;
}

function tick_game() {

    clear_all_cells();

    var i;

    for (i=0 ; i<players.length; i++) {
	update_viewport_scale(players[i]);
	populate_all_cells(players[i]);
    }

    for (i=0; i<players.length; i++) {
    	if (players[i].alive && players[i].dash) {
    	    one_step(players[i]);
    	}
    }

    remove_dead_players();

    for (i=0; i<players.length; i++) {
	if (players[i].alive) {
	    one_step(players[i]);
	}
    }

    remove_dead_players();

    send_client_updates();

    while (players.length < global.minplayers) {
	add_player();
    }

}

function send_client_updates() {
    for (let i=0; i<players.length; i++) {
    	var player_id = players[i].id;
    	var player_socket = sockets[player_id];
    	if (player_socket) {
    	    player_socket.volatile.emit('s_update_players',players);
    	    logger("Sent s_update_players to ",players[i].id);
    	}
    }
}

function one_step(p) {
    if (p.is_robot) {
	turn_robot(p);
	}
    move_player(p);
    if (check_edge_death(p)) {
	p.alive = 0;
    }
    else {
	var killer = check_collision(p);
	if (killer) {
	    award_collision(p,killer);
	    p.alive = 0;
	}
    }
    shift_player(p);
}


function get_collision_object(x,y) {
    if (x <=0 || 
	y <=0 || 
	x >= global.world_dim.width ||
	y >= global.world_dim.height) {
	return false;
    }
    return all_cells[x][y];
}

function check_collision(p) {
    var c = get_collision_object(p.position.x,p.position.y);

    if (c===false) {
	return false;
    }
    if (c === p) {
	return false;
    }
    if (!c.alive) {
	return false;
    }

    return c;
}

function shift_player(p) {

    p.cells.push({x: p.position.x,
		  y: p.position.y
		 });

    if (p.cells.length >= p.size) {
	var tail_position = p.cells.shift();
    }
}

function turn_robot(p) {
    var rnd = Math.random();

    let new_pos = predict_player_position(p,2);

    let c = get_collision_object(new_pos.x,new_pos.y);

    let force_turn = (c===false || (c && c!==p));

    if (force_turn && rnd < 0.5) {
	p.dir = turn_left(p.dir);
    }
    else if (force_turn && rnd >= 0.5) {
	p.dir = turn_right(p.dir);
    }
    else if (rnd < 0.05) {
	p.dir = turn_left(p.dir);
    }
    else if (rnd < 0.12) {
	p.dir = turn_right(p.dir);
    }
}

function predict_player_position(p,steps) {

    var delta = {
	x: 0,
	y: 0,
    };
    
    switch (p.dir) {
    case constant.direction.right: 
	delta.x = 1;
	delta.y = 0;
	break;
    case constant.direction.down: 
	delta.x = 0;
	delta.y = 1;
	break;
    case constant.direction.left: 
	delta.x = -1;
	delta.y = 0;
	break;
    case constant.direction.up: 
	delta.x = 0;
	delta.y = -1;
	break;
    case constant.direction.stopped:
	delta.x = 0;
	delta.y = 0;
	break;
    }
    
    let new_pos = {x: p.position.x + delta.x * steps,
		   y: p.position.y + delta.y * steps,
		  };

    return new_pos;
}

function move_player(p) {

    let new_pos = predict_player_position(p,1);

    p.position.x = new_pos.x;
    p.position.y = new_pos.y;
}

function check_edge_death(p) {
    if (p.position.x < 0 || p.position.y < 0 || p.position.x >= global.world_dim.width || p.position.y >= global.world_dim.height) {
	return true;
    }
    return false;
}

function clear_all_cells() {
    for (var i=0;i<global.world_dim.width;i++) {
	for (var j=0;j<global.world_dim.height;j++) {
	    all_cells[i][j]=0;
	}
    }
}

io.on('connect', function (socket) {
    logger('A user connected!', socket.handshake);

    var type = socket.handshake.query.type;

    // Initialize new player

    var currentPlayer; // Just for legacy code

    var connected_player = new Player();
    connected_player.id = socket.id;
    connected_player.is_robot = false;
    sockets[connected_player.id] = socket;
    players.push(connected_player);
    logger('Player ' + connected_player.id + ' connecting!');

    immortal_socket = socket;

    if (0) {
	(function () {
    	    var emit = socket.emit,
            onevent = socket.onevent;
	    
    	    socket.emit = function () {
    		logger('socket.io', 'emit', arguments[0]);
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

	var old_dir = connected_player.dir;
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

    socket.on('c_request_player_update', function () {
        logger('c_request_player_update from ' + connected_player.id);
	socket.emit('s_update_players',players);
	logger("Sent requested s_update_players to ",connected_player.id);
    });

    socket.on('pingcheck', function () {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', function (data) {
    });

    socket.on('respawn', function () {
    });

    socket.on('disconnect', function () {
	logger("Got disconnect");
        logger('[INFO] User ' + connected_player.id + ' disconnected!');
       socket.broadcast.emit('s_player_disc', connected_player);
    });

    socket.on('kick', function(data) {
    });

    // Heartbeat function, update everytime.  What is target for?
    socket.on('0', function(target) {
	logger("socket.on 0");
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });
});

function log_status() {
    players.forEach( function (player) {
	logger("Player: ",player.id,player.alive,player.size);
    });
}

init_game();

setInterval(tick_game,100);
//setInterval(log_status,5000);


// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || global.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || global.port;
http.listen( serverport, ipaddress, function() {
    logger('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
