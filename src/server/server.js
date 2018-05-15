/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var debug = require('debug')('blubio');

var logger = function(...args) {
    debug(...args);
};

logger("server.js starting up");

app.use(express.static(__dirname + '/../client'));

// Agar Game settings
var conf = {
    "host": "0.0.0.0",
    "port": 3000,
    "networkUpdateFactor": 40,
};

// Import utilities.
var util = require('./lib/util');

// For Blubio

var direction = {stopped: -1, up: 1, down: 2, left: 3, right: 4};

var all_cells = [];

var viewport_player;

var direction_delta = {stopped: { x: 0,  y: 0  },
		       up:      { x: 0,  y: -1 },
		       down:    { x: 0,  y: 1  },
		       left:    { x: -1, y: 0  },
		       right:   { x: 1,  y: 0  },
		      };

var global = {
    grid: 0,
    smallblocks: 0,
    cellsize: 10,
    delaycount: 0,
    startplayers: 100,
    minplayers: 100,
    rotateview: false,
};

var dimension = {
    width: 500,
    height: 350,
};

var view = {
    width: 100,
    height: 70,
};

var map_dim = {
    width: dimension.width / 10,
    height: dimension.width / 10,
};

var users = [];
var sockets = {};
var immortal_socket;


var players = [];
var robot_counter = 0;

function add_player() {
    var player = new Player();
    player.id = "R"+robot_counter++;
    player.is_robot = true;
    players.push(player);
}

// Player Constructor

function Player() {
    this.id = undefined;
    this.is_robot = false;
    this.alive = 1;
    this.dir = direction.up;
    this.dash = false;  // (Math.random() > 0.5);
    this.size = 25;
    this.position = {
	x: Math.floor(Math.random() * (dimension.width-50)) + 25,
	y: Math.floor(Math.random() * (dimension.height-50)) + 25,
    };
    this.shade  = {
	h: Math.floor(Math.random()*360),
	s: 50,
	l: 50,
    };
    this.shade_delta  = {
	h: 3.0,
	s: 1.0,
	l: 0.5,
    };
    this.scale  = 1.0;
    this.cells = [];
}

function init_game() {

    logger("init_game");
    // Initialize "all cells" array for collision detection

    for (var i=0;i<dimension.width;i++) {
	all_cells[i]=[];
	for (var j=0;j<dimension.height;j++) {
	    all_cells[i][j]=0;
	}
    }

    // Add initial players to the players[] array

    for (var x=0;x<global.startplayers;x++) {
	add_player();
    }
}

function update_viewport_scale(p) {
    p.scale = 1; // + Math.min(2,(p.cells.length / 1000));
}

function populate_all_cells(p) {
    for (var i in p.cells) {
	all_cells[p.cells[i].x][p.cells[i].y] = p;
    }
}

function award_collision(killed,killer) {
    killer.size += killed.cells.length;
    killed.size = 1;
    if (killed === viewport_player) {
	viewport_player = killer;
    }
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
    case direction.up: 
	return direction.right;
    case direction.left: 
	return direction.up;
    case direction.down: 
	return direction.left;
    case direction.right: 
	return direction.down;
    }
    return direction.stopped;
}

function turn_left(dir) {
    switch (dir) {
    case direction.up: 
	return direction.left;
    case direction.left: 
	return direction.down;
    case direction.down: 
	return direction.right;
    case direction.right: 
	return direction.up;
    }
    return direction.stopped;
}

function tick_game() {

    clear_all_cells();

    var i;

    for (i in players) {
	update_viewport_scale(players[i]);
	populate_all_cells(players[i]);
    }

    // for (i in players) {
    // 	if (players[i].alive && players[i].dash) {
    // 	    one_step(players[i]);
    // 	}
    // }

    // remove_dead_players();

    for (i in players) {
	if (players[i].alive) {
	    one_step(players[i]);
	}
    }

    remove_dead_players();

    if (1) {
	for (i in players) {
    	    var player_id = players[i].id;
    	    var player_socket = sockets[player_id];
    	    if (player_socket) {
    		player_socket.volatile.emit('s_update_players',players);
    		logger("Sent s_update_players to ",players[i].id);
    	    }
	}
    }

    while (players.length < global.minplayers) {
	add_player();
    }

}

function one_step(p) {
    if (p.is_robot) {
	turn_robot(p);
	}
    move_player(p);
    var killer = check_collision(p);
    if (killer) {
	award_collision(p,killer);
	p.alive = 0;
    }
    shift_player(p);
}


function check_collision(p) {
    var c = all_cells[p.position.x][p.position.y];

    if (c === p) {
	return false;
    }
    if (!c.alive) {
	return false;
    }

    return c;
}

function shift_player(p) {

    p.size += 0.01;
    
    p.cells.push({x: p.position.x,
		  y: p.position.y
		 });

    if (p.cells.length >= p.size) {
	var tail_position = p.cells.shift();
    }
}

function turn_robot(p) {

    var delta = {
	x: 0,
	y: 0,
    };
    
    var rnd = Math.random();

    if (rnd < 0.05) {
	p.dir = turn_left(p.dir);
    }
    else if (rnd < 0.10) {
	p.dir = turn_right(p.dir);
    }
}

function move_player(p) {

    var delta = {
	x: 0,
	y: 0,
    };
    
    switch (p.dir) {
    case direction.right: 
	delta.x = 1;
	delta.y = 0;
	break;
    case direction.down: 
	delta.x = 0;
	delta.y = 1;
	break;
    case direction.left: 
	delta.x = -1;
	delta.y = 0;
	break;
    case direction.up: 
	delta.x = 0;
	delta.y = -1;
	break;
    case direction.stopped:
	delta.x = 0;
	delta.y = 0;
	break;
    }
    
    p.position.x += delta.x;
    p.position.y += delta.y;

    if (p.position.x < 0) {
	p.position.x = 0;
	p.dir = (Math.random() > 0.5 ? direction.up : direction.down) ;
    }

    if (p.position.y < 0) {
	p.position.y = 0;
	p.dir = (Math.random() > 0.5 ? direction.left : direction.right) ;
    }

    if (p.position.x >= dimension.width) {
	p.position.x = dimension.width - 1;
	p.dir = (Math.random() > 0.5 ? direction.up : direction.down) ;
    }

    if (p.position.y >= dimension.height) {
	p.position.y = dimension.height - 1;
	p.dir = (Math.random() > 0.5 ? direction.left : direction.right) ;
    }
}

function clear_all_cells() {
    for (var i=0;i<dimension.width;i++) {
	for (var j=0;j<dimension.height;j++) {
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
	logger("Client time lag = ",Date.now() - clientTime);
    }); 

    socket.on('c_change_direction', function (new_dir) {
        logger('c_change_direction ' + connected_player.id + ' changing direction to ',new_dir);
	connected_player.dir = new_dir;
	logger(socket);

	// var old_dir = connected_player.dir;
	// if (old_dir == new_dir) {
	//     // Do nothing
	// }
	// else if ((old_dir!=direction.left && old_dir!=direction.right) && (new_dir==direction.left || new_dir==direction.right)) {
        //     logger('Changing direction to vertical',new_dir);
	//     connected_player.dir = new_dir;
	// }
	// else if ((old_dir!=direction.up && old_dir!=direction.down) && (new_dir==direction.up || new_dir==direction.down)) {
        //     logger('Changing direction to horizontal',new_dir);
	//     connected_player.dir = new_dir;
	// }
    });

    socket.on('c_request_player_update', function () {
        logger('c_request_player_update from ' + connected_player.id);
	socket.emit('s_update_players',players);
	logger("Sent s_update_players to ",connected_player.id);
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
//setInterval(sendUpdates, 1000 / conf.networkUpdateFactor);


// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || conf.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || conf.port;
http.listen( serverport, ipaddress, function() {
    logger('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
