/*jslint bitwise: true, node: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const debug = require('debug')('blubio');
const fs = require('fs');

debug("server.js starting up with NODE_PATH " + process.env.NODE_PATH );

const globals = require('globals.js');
const constant = require('constant.js');
const Player = require('Player.js');
const RobotPlayer = require('RobotPlayer.js');
const PlayerUpdate = require('PlayerUpdate.js');
const Phyper = require("Phyper.js");

let logger = function(...args) {
    debug(...args);
};

//logger = (() => {});


const html = new Phyper();

const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

logger(html.div({style: html.CSS({"background-color": "white",
				  opacity: "0.7",
				  display: "inline-block",
				  position: "fixed",
				  top: 0,
				  bottom: 0,
				  left: 0,
				  right: 0,
				  width: "50%",
				  height: "50%",
				  margin: "auto"})},
		html.a("Link to Google",{href: "http://www.google.com/"},{target: "_top"}),
		html.a(["List","of","text"],{href: "http://www.yelp.com/"},{target: "_top"}),
		html.br({clear:null}),
		html.select({id:"demo1"},[0,1,2,3,4,5,6,7,8,9].map(x => html.option({value: x},x==5 ? {selected: null} : {}))),
		html.select({id:"demo2"},[...Array(20).keys()].map(x => html.option({value: x},x==15 ? {selected: null} : {}))),
		html.select({id:"demo3"},months.map(x => html.option({value: x},x))),
		html.select({id:"demo4"},[...months.keys()].map(x => html.option({value: x+1},months[x]))),
		html.ul(["dogs","cats","birds","hampsters"].map(x => html.li(x + " are the best"))),
		html.ul(["dogs","cats","birds","hampsters"].reduce((acc,val) => acc + html.li(val + " are the best"),"")),
		html.table(html.tr(html.td("Hello"),html.td("There"),html.td("How"))),
		html.a("Link to Mauicomputing",{href: "http://www.google.com/"}),
		html.br(),
		html.hr({width:10}),
		html.textarea("Here is some editable text"),
		html.form({action: "index.html",method: "get"},
			  "Bluby:",html.input({type: "text", name: "bluby"}),
			  "Loves:",html.input({type: "text", name: "loves"}),
			  "You:",html.input({type: "text", name: "you"}),
			  html.input({type: "submit", name: "process"}))
		
    ));

app.use(express.static(__dirname + '/../client'));

let all_cells = [];
global.all_cells = all_cells;

let users = [];
let sockets = {};
let immortal_socket;
let player_num = 1;

let server_status = {};
let players = [];
let food = [];

let last_out_bytes = 0;
let last_out_packets = 0;
let last_in_bytes = 0;
let last_in_packets = 0;
let last_network_monitor = 0;

function add_robot() {
    let player = new RobotPlayer();
    players.push(player);
    return player;
}

function update_viewport_scale(p) {
    p.scale = 1 + Math.min(4,((p.size - globals.startsize) / 1000));
}

function update_shade(p) {

    p.shade.h += p.shade_delta.h;
    if (p.shade.h > p.shade_max.h || p.shade.h < p.shade_min.h) {
	p.shade_delta.h = 0 - p.shade_delta.h;
    }

    p.shade.l += p.shade_delta.l;
    if (p.shade.l > p.shade_max.l || p.shade.l < p.shade_min.l) {
	p.shade_delta.l = 0 - p.shade_delta.l;
    }

    p.shade.s += p.shade_delta.s;
    if (p.shade.s > p.shade_max.s || p.shade.s < p.shade_min.s) {
	p.shade_delta.s = 0 - p.shade_delta.s;
    }
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

function award_collision(killed,killer) {
    let awarded = killed.cells.length - 90;

    if (awarded > 0) {
	killer.size += awarded;
    }

    killed.size = 1;
}

function monitor_network() {
    fs.readFile('/proc/net/dev', function(err, data) {
	if (err) {
	    throw err;
	}
	let re = (/eth0: *(.+)/);
	let file = data.toString();
	let match = re.exec(file);
	let matched_line = match[1];
	let array = matched_line.split(/ +/);
	let out_bytes = array[8];
	let out_packets = array[9];
	let in_bytes = array[0];
	let in_packets = array[1];

	let rate_out_bytes = (out_bytes - last_out_bytes);
	let rate_out_packets = (out_packets - last_out_packets);
	let rate_in_bytes = (in_bytes - last_in_bytes);
	let rate_in_packets = (in_packets - last_in_packets);

	server_status.network_speed = `Out: ${rate_out_bytes.toFixed(2)} Bps ${rate_out_packets.toFixed(2)} pkt/sec In: ${rate_in_bytes.toFixed(2)} Bps ${rate_in_packets.toFixed(2)} pkt/sec`;

	last_out_bytes = out_bytes;
	last_out_packets = out_packets;
	last_in_bytes = in_bytes;
	last_in_packets = in_packets;
    });
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

    let tick_game_start = Date.now();

    clear_all_cells();

    let i;

    for (i=0 ; i<players.length; i++) {
	update_viewport_scale(players[i]);
	update_shade(players[i]);
    }

    populate_all_cells();

    for (i=0; i<players.length; i++) {
	if (players[i].alive) {
	    one_step(players[i]);
	    populate_all_cells();
	    if (players[i].dash) {
		one_step(players[i]);
		populate_all_cells();
		if (players[i].is_robot) {
//		    players[i].dash--;
		}
	    }
	}
    }

    update_clients();

    remove_dead_players();

    while (players.length < globals.minplayers) {
	let player = add_robot();
	logger("Sending s_add_player");
	io.sockets.emit('s_add_player',player);
    }
    server_status.num_players = `Number Players (server): ${players.length}`;
    server_status.tick_game = `tick_game took ${Date.now() - tick_game_start} ms.`;
}

function update_clients() {
    let updates = [];

    for (let i=0; i<players.length; i++) {
	let player = players[i];
	let update = new PlayerUpdate();

	// Note that some of these items are objects and must not be modified
	// or they will change the data in the players array.

	update.id = player.id;
	update.alive = player.alive;
	update.size = player.size;
	update.dash = player.dash;
	update.position = player.position;
	update.shade = player.shade;
	update.scale = player.scale;
	update.first_cell = player.first_cell; // Number of times "shift" has been called
	update.last_cell = player.last_cell;   // Number of times "push" has been called
	update.last_cells = player.cells.slice(-3); // Last N cells

	updates.push(update);
    }

    for (let i=0; i<updates.length; i++) {
    	let player_socket = sockets[updates[i].id];
    	if (player_socket) {
    	    player_socket.emit('s_update_client',updates);
    	}
    }

}

function send_server_status() {
    logger(server_status);
    io.sockets.emit('s_server_status',server_status);
}

function one_step(p) {
    if (p.is_robot) {
	p.turn();
	}
    p.move();
    if (check_edge_death(p)) {
	p.alive = 0;
    }
    else {
	let killer = p.check_collision();
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
	x >= globals.world_dim.width ||
	y >= globals.world_dim.height) {
	return false;
    }
    return all_cells[x][y];
}

function shift_player(p) {

    if (p.cells.length >= p.size) {
	let tail_position = p.cells.shift();
	p.first_cell++;
    }

    p.cells.push({x: p.position.x,
		  y: p.position.y
		 });

    p.last_cell++;

    

}

function move_player(p) {

    let new_pos = p.predict_position(1);

    p.position.x = new_pos.x;
    p.position.y = new_pos.y;
}

function check_edge_death(p) {
    if (p.position.x < 0 || p.position.y < 0 || p.position.x >= globals.world_dim.width || p.position.y >= globals.world_dim.height) {
	return true;
    }
    return false;
}

function clear_all_cells() {
    for (let i=0;i<globals.world_dim.width;i++) {
	for (let j=0;j<globals.world_dim.height;j++) {
	    all_cells[i][j]=0;
	}
    }
}

function log_players() {
    players.forEach( function (player) {
	logger("Player: ",player.id,player.alive,player.size);
    });
}

io.on('connect', function (socket) {
    logger('A user connected!', socket.handshake);

    let type = socket.handshake.query.type;

    // Initialize new player

    let currentPlayer; // Just for legacy code

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

    socket.on('pingcheck', function () {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', function (data) {
    });

    socket.on('c_log', function (data) {
	logger("Client says: ",data);
    });

    socket.on('disconnect', function () {
	logger("Got disconnect");
        logger('[INFO] User ' + connected_player.id + ' disconnected!');
       socket.broadcast.emit('s_player_disc', connected_player);
    });

    socket.on('kick', function(data) {
    });

    // Heartbeat function, update everytime.  What is target for?
    // socket.on('0', function(target) {
    // 	logger("socket.on 0");
    //     currentPlayer.lastHeartbeat = new Date().getTime();
    //     if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
    //         currentPlayer.target = target;
    //     }
    // });

});

function init_game() {

    logger("init_game");
    // Initialize "all cells" array for collision detection

    for (let i=0;i<globals.world_dim.width;i++) {
	all_cells[i]=[];
	for (let j=0;j<globals.world_dim.height;j++) {
	    all_cells[i][j]=0;
	}
    }

    // Add initial players to the players[] array

    for (let x=0;x<globals.startplayers;x++) {
	add_robot();
    }
}

init_game();

setInterval(tick_game,80);
setInterval(monitor_network,1000);
setInterval(send_server_status,1000);
//setInterval(log_status,5000);


// Don't touch, IP configurations.
let ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || globals.host;
let serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || globals.port;
http.listen( serverport, ipaddress, function() {
    logger('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
