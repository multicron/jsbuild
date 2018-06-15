// jshint bitwise: true
// jshint browser: true
// jshint devel: true
// jshint strict: true
// jshint -W097
// jshint lastsemic: true

'use strict';

const io = require('socket.io-client');
const globals = require('globals.js');
const constant = require("constant.js");
const Player = require("Player.js");
const Observer = require("Observer.js");
const Timer = require("Timer.js");
const crypto = require("crypto");
const PowerUp = require("PowerUp.js");

const html = require("Phyper.js");

let socket;

let logger = function(...args) {
    if (console && console.log) {
        console.log(...args);
    }
};

logger = function(...args) {
    if (socket) {
	socket.emit('c_log',[...args]);
    }
};

logger = function() {};

// The whole world and its 2d context
let board;
let board_ctx;

// A canvas for a zoomed-in magnifying glass view
let zoomer;
let zoomer_ctx;

// The players view of the game (the scale of this varies)
let viewport;
let viewport_ctx;

// A view of the whole board one window wide (not currently used)
let map;
let map_ctx;

// A small rendering of the whole world
let radar;
let radar_ctx;

// The timeout that is going to make the mouse pointer disappear after a short time
let clear_cursor_timeout;

// The player who is viewing the game viewport
let viewport_player;

// Once viewport_player has died, this object starts to watch the game instead of a player
let observer;

// Screen elements
let div_server_status = document.createElement('div');
let div_leaderboard = document.createElement('div');
let div_login = document.createElement('div');
let div_viewport = document.createElement('div');

// Are we playing?
let playing = false;

// The world
let players = [];
let powerups = [];

// Status messages and statistics
let server_status = {};
let client_status = {};
let world_updates = 0;
let player_updates = 0;
let player_adds = 0;
let world_changed = false;
let skipped_animations = 0;

const anim_delay_timer = new Timer((timer) => {client_status.animate_delay = "delay between animations " + timer.times.join(" ")},25);
const anim_timer = new Timer((timer) => {client_status.animate = "animate took " + timer.times.join(" ")},25);
const refresh_timer = new Timer((timer) => {client_status.refresh_player = "refresh_player took " + timer.times.join(" ")});
const viewport_update_timer = new Timer((timer) => {client_status.update_viewport = "update_viewport took " + timer.time + "ms"});
const update_players_timer = new Timer((timer) => {client_status.update_players = "update_players took " + timer.time + "ms"});

init();
animate();

function get_player_by_id(id) {
    return players.find(p => {return p.id == id});
}

// Called when the "Play" button is pressed

function play(event) {
    if (event) {
	event.preventDefault();
    }

    if (socket) {
	socket.disconnect();
    }

    let login_name = $("#login_name").val().substr(0,globals.max_name_length);

    socket = io({query:{type:"player",
			name:login_name}});

    init_socket(socket);

    if (login_name !== "") {
	socket.emit("c_set_player_name",login_name);
    }

    socket.emit("c_request_world_update");

    playing = true;

}

function die() {
    observer = new Observer(viewport_player);

    playing = false;

    let aplayer = new Player();

    $(div_login).show();
    $("#killed_by").text(`Your high score was ${viewport_player.score}`).show();
    $("#login_name").val(observer.name);
    $("#play_button").focus();
}

function init() {

    const page = document.body;

    page.style.background = globals.bgcolor;

    // A div for server status

    div_server_status.style.cssText = html.CSS({"background-color": "none",
						"color": "white",
						opacity: "0.5",
						display: "inline-block",
						position: "fixed",
						top: 0,
						left: 0,
						"padding-left": "10px",
						width: "100%",
						height: "50%",
						margin: "auto",
						overflow: "auto"
					       });

    div_server_status.innerHTML = html.div("Server Status");

    $(div_server_status).hide();

    div_leaderboard.style.cssText = html.CSS({"background-color": "none",
					      "color": "white",
					      opacity: "1",
//					      display: "inline-block",
					      display: "flex",          
					      "font-family": "arial",
					      "flex-direction": "column", 
//					      "justify-content": "center",
					      "align-items": "center",
					      position: "fixed",
					      top: 0,
					      right: 0,
					      "padding-right": "10px",
					      width: "20%",
					      height: "30%",
					      margin: "auto",
					      overflow: "auto",
					      "overflow-x": "hidden",
					      "overflow-y": "hidden",
					     });

    div_leaderboard.innerHTML = html.div("Leaderboard");

    // A div for the entering/exiting overlay

    div_login.style.cssText = html.CSS({"background-color": "blue",
				  opacity: "0.8",
				  display: "inline-block",
				  position: "fixed",
			          "text-align": "center",		
				  top: 0,
				  bottom: 0,
				  left: 0,
				  right: 0,
				  width: "50%",
				  height: "50%",
				  margin: "auto",
				  overflow: "auto"
				 });

    div_login.innerHTML = html.JOIN(html.h1("splines.io"),
				    html.h2({id: "killed_by"},"You were killed"),
				    html.div({style: html.CSS({width: "90%",
							       height: "30%",
							       top: 0,
							       left: 0,
							       bottom: 0,
							       right: 0,
							       margin: "auto",
							       "background-color": "white", 
							      })},
					     html.br(),
					     html.form({action: "index.html",
							method: "get",
							id: "login_form"},
						       html.p(html.h3("Player name?")),
						       html.input({type: "text", 
								   maxlength: globals.max_name_length,
								   id: "login_name"}),
						       html.input({type: "submit", 
								   name: "play_button",
								   value: "Play", 
								   id: "play_button"})),
					     html.br()));
    
    // Canvases

    // A map of the entire board, same size as the viewport

    map = document.createElement( 'canvas' );
    map.width = globals.view_dim.width * globals.cellsize;
    map.height = globals.view_dim.height * globals.cellsize;
    map_ctx = map.getContext( '2d' , {alpha: globals.context_alpha});
    map_ctx.imageSmoothingEnabled = false;

    // A radar of the entire board, 1/16th the size of the viewport

    radar = document.createElement( 'canvas' );
    radar.width = (globals.view_dim.width / 4) * globals.cellsize;
    radar.height = (globals.view_dim.height / 4) * globals.cellsize;

    radar.style.cssText = html.CSS({"background-color": "blue",
				    "color": "white",
				    opacity: "1.0",
				    display: "inline-block",
				    position: "fixed",
				    bottom: 0,
				    right: 0,
				    width: (radar.width) + "px",
				    height: (radar.height) + "px",
				    margin: "auto",
				    overflow: "auto",
				    border: "1px solid white",
				   });

    radar_ctx = radar.getContext( '2d' , {alpha: globals.context_alpha});
    radar_ctx.imageSmoothingEnabled = true;

    // The entire playing field

    board = document.createElement( 'canvas' );
    board.width = globals.world_dim.width * globals.cellsize;
    board.height = globals.world_dim.height * globals.cellsize;
    board_ctx = board.getContext( '2d', {alpha: globals.context_alpha});
    board_ctx.strokeRect(0,0,board_ctx.canvas.width,board_ctx.canvas.height);

    // The current player's view into the board

    viewport = document.createElement( 'canvas' );
    viewport.id = "viewport";

    viewport.width = globals.view_dim.width * globals.cellsize;
    viewport.height = globals.view_dim.height * globals.cellsize;
    viewport.style.cssText = html.CSS({
//	"background-color": globals.edgecolor,
	background: "radial-gradient(red,black)",
	"color": "white",
	opacity: "1.0",
	display: "inline-block",
	position: "fixed",
	top: 0,
	left: 0,
	width: "100%",
	margin: "auto",
	overflow: "auto",
    });

    viewport_ctx = viewport.getContext( '2d', {alpha: globals.context_alpha});
    viewport_ctx.imageSmoothingEnabled = false;

    // The zoomed-in view for high scale factors

    zoomer = document.createElement( 'canvas' );
    zoomer.id = "zoomer";

    zoomer.width = globals.zoomer_dim.width * globals.cellsize;
    zoomer.height = globals.zoomer_dim.height * globals.cellsize;
    zoomer.style.cssText = html.CSS({"background-color": globals.edgecolor,
				     "color": "white",
				     opacity: "1.0",
				     display: "inline-block",
				     position: "fixed",
				     bottom: 0,
				     top: 0,
				     right: 0,
				     left: 0,
				     width: zoomer.width + "px",
				     height: zoomer.height + "px",
				     margin: "auto",
				     overflow: "auto",
				     border: "1px solid white"
				    });

    zoomer_ctx = zoomer.getContext( '2d', {alpha: globals.context_alpha});
    zoomer_ctx.imageSmoothingEnabled = false;

    $(zoomer).hide();

    div_viewport.appendChild(viewport);

    page.appendChild(div_viewport);
    page.appendChild(radar);
    page.appendChild(div_server_status);
    page.appendChild(div_leaderboard);
    page.appendChild(div_login);


    // Capture keyboard events

    $(window).keypress(log_event);
    $(window).keydown(key_down);
    $(window).keyup(key_up);
    $(window).mouseout(log_event);
    $(window).mousemove(mouse_move);

    $("#login_name").focus();
    $("#play_button").keydown(play_button_key_down);
    $("#login_form").submit(play);
    $("#killed_by").hide();

    window.setInterval(request_leaderboard,1000);
    window.setInterval(request_latency,1000);
    window.setInterval(update_radar,500);

    mouse_move();
}

function request_latency() {
    socket.emit('c_latency', Date.now(), function(startTime) {
	let latency = Date.now() - startTime;
	client_status.latency = "Latency to server is:" + latency;
    });
}

function update_status() {
    let status = "";

    if (viewport_player) {
	client_status.scale = `Scale: ${viewport_player.scale.toPrecision(2)} Dash: ${viewport_player.dash}`;
    }
    client_status.num_players = `Number Players (client): ${players.length}`;
    client_status.world_updates = `World Updates: ${world_updates} Player Updates: ${player_updates} Player Adds: ${player_adds}`;
    client_status.skipped_anim = `Skipped Animations: ${skipped_animations}`;

    if (socket) {
	client_status.transport = `Transport: ${socket.io.engine.transport.name}`;
    }

    for (let category in server_status) {
	status += server_status[category] + "<br>";
    }

    for (let category in client_status) {
	status += client_status[category] + "<br>";
    }

    div_server_status.innerHTML = html.div(status);
}

function mouse_move(event) {
    div_viewport.style.cursor = "default";

    if (clear_cursor_timeout) window.clearTimeout(clear_cursor_timeout);
    clear_cursor_timeout = window.setTimeout(() => {div_viewport.style.cursor = "none"}, 2500);
}

function keycode_to_dir(keycode) {
    switch (keycode) {
    case constant.keycode.left:
	return constant.direction.left;
    case constant.keycode.right:
	return constant.direction.right;
    case constant.keycode.up:
	return constant.direction.up;
    case constant.keycode.down:
	return constant.direction.down;
    default:
	return undefined;
    }
}


function key_down(event) {

    let new_dir = keycode_to_dir(event.which);
    if (new_dir) {
	event.preventDefault();
	logger("Sending direction change to",new_dir);
	socket.emit('c_change_direction',new_dir);
    }
    else {
	if (event.which === constant.keycode.r) {
	    socket.emit('c_request_world_update');
	}
	else if (event.which === constant.keycode.i) {
	    $(div_server_status).toggle();
	}
	else if (event.which === constant.keycode.shift) {
	    $(zoomer).show();
	}
	else if (event.which === constant.keycode.space) {
	    socket.emit('c_change_dash', 1);
	}
    }
}

function play_button_key_down(event) {
    // Prevent the space bar from pressing the "Play" button
    if (event.which === constant.keycode.space) {
	event.preventDefault();
    }
}

function key_up(event) {
    let new_dir = keycode_to_dir(event.which);
    if (new_dir) {
	event.preventDefault();
    }
    else {
	if (event.which === constant.keycode.shift) {
	    $(zoomer).hide();
	}
	else if (event.which === constant.keycode.space) {
	    socket.emit('c_change_dash', 0);
	}
    }
}

function log_event(event) {
    logger(event);
}

function get_mouse_pos(canvas, event) {
    let rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        y: (event.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    };
}

function mouse_pos_to_dir(passed_point) {
    let pt = {x: passed_point.x,
	      y: passed_point.y
	     };
    
    let center = {
	x: viewport.width / 2,
	y: viewport.height / 2
    };

    let tolerance = {
	x: 5,
	y: 5
    };

    pt.x -= center.x;
    pt.y -= center.y;

    if (pt.x + tolerance.x < 0 && pt.x < pt.y) return constant.direction.left;
    if (pt.x - tolerance.x > 0 && pt.x > pt.y) return constant.direction.right;
    if (pt.y + tolerance.y < 0 && pt.x >= pt.y) return constant.direction.up;
    if (pt.y - tolerance.y > 0 && pt.x <= pt.y) return constant.direction.down;

    return pt;
}

function update_player_cells (player,update) {
    logger("Update_player_cells for Player "+player.id);

    if (player) {
	let old_cells = player.cells;

	// Catch the tail up to the server

	logger("player.first_cell " + player.first_cell + ", update.first_cell " + update.first_cell);
	logger("player.last_cell " + player.last_cell + ", update.last_cell " + update.last_cell);

	while (player.first_cell < update.first_cell) {
	    logger("Shifting player "+player.first_cell);
	    player.cells.shift();
	    player.first_cell++;
	}
	
	if (player.last_cell < update.last_cell) {
	    let num_to_add = update.last_cell - player.last_cell;
	    let first_cell_to_add = update.last_cells.length - num_to_add;

	    if (num_to_add > update.last_cells.length) {
		logger("Too far behind-- requesting player update");
		socket.emit('c_request_update_one_player',player.id);
	    }
	    else {
		logger("Adding to player "+num_to_add+" first cell "+first_cell_to_add + " length " + update.last_cells.length);
		
		for (let x = first_cell_to_add; x < update.last_cells.length ; x++) {
		    player.cells.push(update.last_cells[x]);
		}
		
		player.last_cell = update.last_cell;
	    }
	}
    }
}

function update_players (updates) {
    update_players_timer.start();
    for (let i=0; i<updates.length; i++) {
	let update = updates[i];
	
	// If we don't have this player yet, we can't update it
	
	let player = get_player_by_id(update.id);

	if (!player) {
	    socket.emit('c_request_update_one_player',update.id);
	    }
	else {
	    player.size = update.size;
	    player.dash = update.dash;
	    player.alive = update.alive;
	    player.position = update.position;
	    player.shade = update.shade;
	    player.scale = update.scale;
	    player.powerups = update.powerups;
	    
	    update_player_cells(player,update);
	}
	
	remove_dead_players();
	update_players_timer.end();
    }
}

function remove_dead_players() {
    let i = players.length;
    while (i--) {
	if (!players[i].alive) {
	    if (players[i] === viewport_player) {
		die();
	    }
	    players.splice(i, 1);
	} 
    }
}


function init_socket(socket) {
    socket.on('s_server_status', function (status) {
	server_status = status;
    });
    
    socket.on('s_update_client', function (updates) {
	world_changed = true;
	update_players(updates);
    });

    socket.on('s_update_world', function (players_from_server) {
	logger("Got world update");
	world_changed = true;
	// Items in the JSON Array of objects received from the server are not instances of Player.
	let new_world = [];
	players_from_server.forEach((player) => {
	    let new_player = new Player();
	    Object.assign(new_player,player);
	    new_world.push(new_player);
	});
	players = new_world;
    });

    socket.on('s_update_powerups', function (powerups_from_server) {
	logger("Got update_powerups");

	// let new_powerups = [];

	// powerups_from_server.forEach((powerup) => {
	//     let new_powerup = new PowerUp();
	//     Object.assign(new_powerup,powerup);
	//     new_powerups.push(new_powerup);
	// });
	// powerups = new_powerups;

	powerups = powerups_from_server;
    });

    socket.on('s_update_leaderboard', function (leaders) {
	logger("Got leaderboard update");
	div_leaderboard.innerHTML = fillin_leaderboard(leaders);
    });

    socket.on('s_update_one_player', function (player) {
	logger("Got update_one_player");
	let existing = get_player_by_id(player.id);

	world_changed = true;

	// If we already have this player, update it,
	// but if we don't have it, add it.

	if (existing) {
	    player_updates++;
	    Object.assign(existing,player);
	}
	else {
	    player_adds++;
	    // The data received from socket.io is not an instance of Player
	    let new_player = new Player();
	    Object.assign(new_player,player);
	    players.push(new_player);
	}
    });

    socket.on('player_died', function () {
        globals.gameStart = false;
        globals.died = true;
        window.setTimeout(function() {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            globals.died = false;
            if (globals.animLoopHandle) {
                window.cancelAnimationFrame(globals.animLoopHandle);
                globals.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('player_kicked', function (data) {
        globals.gameStart = false;
        globals.kicked = true;
        socket.close();
    });
}

function fillin_leaderboard(leaders) {
        return html.div("Leaderboard") + html.table(leaders.map(function (p){

	return html.tr(
	    html.td({style: html.CSS(
		{color: 'hsl('+p.shade.h+','+p.shade.l+'%,'+p.shade.s+'%)',
		 width: "90%"}
	    )},p.name,p.pending_score > 0 ? "+" + p.pending_score : ""),
	    html.td({align: "right"},p.score)
	);
    }));
}



function draw_axes(ctx) {
    for (let x = -1000; x <= 1000; x+=10) {
	ctx.beginPath();
	ctx.moveTo(x,-1000);
	if (x < 0) {
	    ctx.strokeStyle = 'rgb(255,0,0)';
	    }
	else if (x > 0) {
	    ctx.strokeStyle = 'rgb(0,255,0)';
	}
	else {
	    ctx.strokeStyle = 'rgb(0,0,0)';
	}
	ctx.lineTo(x,1000);
	ctx.closePath();
	ctx.stroke();
    }
    for (let y = -1000; y <= 1000; y+=10) {
	ctx.beginPath();
	ctx.moveTo(-1000,y);
	if (y < 0) {
	    ctx.strokeStyle = 'rgb(255,0,0)';
	    }
	else if (y > 0) {
	    ctx.strokeStyle = 'rgb(0,255,0)';
	}
	else {
	    ctx.strokeStyle = 'rgb(0,0,0)';
	}
	ctx.lineTo(1000,y);
	ctx.closePath();
	ctx.stroke();
    }
}

let delaycount = 0;

function request_leaderboard() {
    socket.emit('c_request_leaderboard');
}

function animate() {
    // Measure the delay between invocations of this function
    anim_delay_timer.end();
    anim_delay_timer.start();

    // Immediately request another frame
    window.requestAnimationFrame( animate );

    if (!world_changed) {
	skipped_animations++;
	return;
    }
    else {
	world_changed = false;
    }

    // Time the whole animate process
    anim_timer.start();

    // Get the player that is connected to the server
    let this_player = get_player_by_id(socket.id);

    if (this_player) {
	$(div_login).hide();
	viewport_player = this_player;
    }
    else if (observer) {
	viewport_player = observer;
    }
    else {
	viewport_player = null;
    }

    clear_board();

    refresh_timer.start();

    players.forEach(player => {
	refresh_player(player);
    });

    powerups.forEach(powerup => {
	refresh_powerup(powerup);
    });

    refresh_timer.end();

    players.forEach(player => {
	draw_name(player);
    });

    if (viewport_player) {
	update_viewport(viewport_player);
    }

    update_status();

    anim_timer.end();
    
}

function update_viewport(p) {
    viewport_update_timer.start();

    let width = globals.world_dim.width;
    let height = globals.world_dim.height;

    let x = p.position.x - p.scale*globals.view_dim.width/2;
    let y = p.position.y - p.scale*globals.view_dim.height/2;

    viewport_ctx.strokeStyle = 'rgb(0,0,0)';
    viewport_ctx.clearRect( 0, 0, viewport_ctx.canvas.width, viewport_ctx.canvas.height);

    // Clip out the portion of the canvas corresponding to where the player is on the board;

    let x_pixel = x * globals.cellsize;
    let y_pixel = y * globals.cellsize;

    let width_pixel = viewport_ctx.canvas.width;
    let height_pixel = viewport_ctx.canvas.height;

//	viewport_ctx.drawImage(board,
//			       x_crop,
//			       y_crop,
//			       width_crop,
//			       height_crop,
//			       x_dst,
//			       y_dst,
//			       width_dst,
//			       height_dst);

    viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel*p.scale,height_pixel*p.scale,0,0,width_pixel,height_pixel);

    viewport_update_timer.end();
}

function update_zoomer(p) {
    let update_zoomer_start = Date.now();

    let width = globals.world_dim.width;
    let height = globals.world_dim.height;

    let x = p.position.x - globals.zoomer_dim.width/2;
    let y = p.position.y - globals.zoomer_dim.height/2;

    zoomer_ctx.strokeStyle = 'rgb(0,0,0)';
    zoomer_ctx.clearRect( 0, 0, zoomer_ctx.canvas.width, zoomer_ctx.canvas.height);

    // Clip out the portion of the canvas corresponding to where the player is on the board;

    let x_pixel = x * globals.cellsize;
    let y_pixel = y * globals.cellsize;

    let width_pixel = zoomer_ctx.canvas.width;
    let height_pixel = zoomer_ctx.canvas.height;


    zoomer_ctx.drawImage(board,         // source canvas
			 x_pixel,       // source rect cropping
			 y_pixel,       // source rect cropping
			 width_pixel,   // source rect cropping
			 height_pixel,  // source rect cropping
			 0,             // destination rect
			 0,             // destination rect
			 width_pixel,   // destination rect
			 height_pixel   // destination rect
			);

    client_status.zoomer_update = "Zoomer update took " +(Date.now() - update_zoomer_start) + "ms";
}

function update_map(p) {
    let width = globals.map_dim.width;
    let height = globals.map_dim.height;

    map_ctx.clearRect( 0, 0, map_ctx.canvas.width, map_ctx.canvas.height);
    map_ctx.strokeRect(0, 0, map_ctx.canvas.width, map_ctx.canvas.height);
    map_ctx.strokeStyle = 'rgb(0,0,0)';

    map_ctx.drawImage(board,
		      0,0,
		      board.width,
		      board.height,
		      0,0,
		      map.width,
		      map.height
		     );
}

function update_radar() {
    let width = globals.world_dim.width/32;
    let height = globals.world_dim.height/32;

    radar_ctx.strokeStyle = 'rgb(255,255,255)';
    radar_ctx.fillRect( 0, 0, radar_ctx.canvas.width, radar_ctx.canvas.height);
    radar_ctx.strokeStyle = 'rgb(0,0,0)';
    radar_ctx.strokeRect(0, 0, radar_ctx.canvas.width, radar_ctx.canvas.height);
    radar_ctx.strokeRect(1, 1, radar_ctx.canvas.width-1, radar_ctx.canvas.height-1);

    radar_ctx.drawImage(board,
			0,0,
			board.width,
			board.height,
			0,0,
			radar.width,
			radar.height
		       );
}

function refresh_powerup(powerup) {
    let cell = powerup.position;

    let color = globals.headcolor;

    board_ctx.fillStyle = color;

    if (powerup.type === constant.powerup.multiplier) {
	board_ctx.beginPath();
	board_ctx.moveTo((cell.x)*globals.cellsize,
			 (cell.y)*globals.cellsize);
	board_ctx.lineTo((cell.x+1)*globals.cellsize,
			 (cell.y+1)*globals.cellsize);
	board_ctx.moveTo((cell.x+1)*globals.cellsize,
			 (cell.y)*globals.cellsize);
	board_ctx.lineTo((cell.x)*globals.cellsize,
			 (cell.y+1)*globals.cellsize);
	board_ctx.stroke();
    }
    else if (powerup.type === constant.powerup.scale) {
	board_ctx.beginPath();
	board_ctx.moveTo((cell.x+0.5)*globals.cellsize,
			 (cell.y)*globals.cellsize);
	board_ctx.lineTo((cell.x+0.5)*globals.cellsize,
			 (cell.y+1)*globals.cellsize);
	board_ctx.moveTo((cell.x)*globals.cellsize,
			 (cell.y+0.5)*globals.cellsize);
	board_ctx.lineTo((cell.x+1)*globals.cellsize,
			 (cell.y+0.5)*globals.cellsize);
	board_ctx.stroke();
    }

}


function refresh_player(p) {
//    adjust_shade(p.shade,p.shade_delta,p.shade);

    let shade = {
	h:p.shade.h,
	l:p.shade.l,
	s:p.shade.s,
    };

    let shade_delta = {
	h:p.shade_delta.h,
	l:p.shade_delta.l,
	s:p.shade_delta.s,
    };

    p.lines = cells_to_lines(p.cells);

    if (Date.now() - p.create_time < globals.safety_time) {
	if (p.flashing===1) {
	    p.lines.forEach((line) => {draw_line(line,shade)});
	    p.flashing = 0;
	}
	else {
	    p.flashing = 1;
	}
    }
    else {
	p.lines.forEach((line) => {draw_line(line,shade)});
    }
    
    draw_head(p);

}

function cells_to_lines (cells) {

    let start_x,start_y;
    let end_x,end_y;
    let start, end;
    let lines = [];
    let line;

    if (cells.length <= 0) return lines;

    function push_line(cell) {
	lines.push({start:{x:start_x,y:start_y},end:{x:end_x,y:end_y}});

	horiz = false;
	vert = false;

	if (cell) {
	    start_x = end_x = cell.x;
	    start_y = end_y = cell.y;
	}
    }

    start_x = end_x = cells[0].x;
    start_y = end_y = cells[0].y;

    let horiz = false;
    let vert = false;

    for (let i = 1 ; i < cells.length; i++) {
	let cell = cells[i];

	if (cell.x != end_x && cell.y != end_y) {
	    push_line(cell);
	}

	if (vert && cell.x != end_x) { // End of vertical line
	    push_line(cell);
	}
	
	if (horiz && cell.y != end_y) { // End of horizontal line
	    push_line(cell);
	}

	if (cell.x == end_x) { // Building a vertical line
	    end_x = cell.x;
	    end_y = cell.y;
	    vert = true;
	}
	else if (cell.y == end_y) { // Building a horizontal line
	    end_x = cell.x;
	    end_y = cell.y;
	    horiz = true;
	}
	else {
	    logger("assertion failed");
	}
    }

    push_line();

    return lines;
}

function draw_cell(cell,shade) {
    let color = 'hsl('+shade.h+','+shade.l+'%,'+shade.s+'%)';

    board_ctx.fillStyle = color;

    if (globals.smallblocks) {
	board_ctx.fillRect((cell.x*globals.cellsize)+1,
			    (cell.y*globals.cellsize)+1,
			    globals.cellsize-2,
			    globals.cellsize-2);
    }
    else {
	board_ctx.fillRect((cell.x*globals.cellsize),
			    (cell.y*globals.cellsize),
			    globals.cellsize,
			    globals.cellsize);
    }
}

function draw_head(p) {
    let cell = p.position;

    let color = globals.headcolor;

    if (p.dash) {
	color = globals.dashcolor;
    }

    board_ctx.fillStyle = color;

    if (globals.smallblocks) {
	board_ctx.fillRect((cell.x*globals.cellsize)+1,
			    (cell.y*globals.cellsize)+1,
			    globals.cellsize-2,
			    globals.cellsize-2);
    }
    else {
	board_ctx.fillRect((cell.x*globals.cellsize),
			    (cell.y*globals.cellsize),
			    globals.cellsize,
			    globals.cellsize);
    }
}

function draw_name(p) {
    let color = 'hsl('+p.shade.h+','+p.shade.l+'%,'+p.shade.s+'%)';
    board_ctx.fillStyle = color;

    let scale = p.scale;

    board_ctx.font = Math.floor(12*scale) + 'px Verdana';

    let name = p.name;

    if (p.pending_score > 0) {
	name = p.name + ('+') + p.pending_score;
    }

    // if (p.cells.length === p.size) {
    // 	name += "(" + p.size + ")";
    // 	}
    // else {
    // 	name += "(" + p.cells.length + "/" + p.size + ")";
    // }
	
    board_ctx.fillText(name,
		       (p.position.x+1)*globals.cellsize + 1,
		       p.position.y*globals.cellsize);
}

function draw_line(line,shade) {
    let color = 'hsl('+shade.h+','+shade.l+'%,'+shade.s+'%)';

    board_ctx.fillStyle = color;

//    logger("Line ",line.start.x,line.start.y,"to",line.end.x,line.end.y);

    let line_left = Math.min(line.end.x,line.start.x);
    let line_top  = Math.min(line.end.y,line.start.y);

    let width = Math.abs((line.end.x - line.start.x))+1;
    let height = Math.abs((line.end.y - line.start.y))+1;

    board_ctx.fillRect(line_left*globals.cellsize,
		       line_top*globals.cellsize,
		       width * globals.cellsize,
		       height * globals.cellsize);
}

function clear_board() {
    board_ctx.fillStyle = globals.bgcolor;
    board_ctx.strokeStyle = 'rgb(255,0,0)';

    board_ctx.fillRect(0,0,board_ctx.canvas.width,
			 board_ctx.canvas.height);
    board_ctx.strokeRect(0,0,board_ctx.canvas.width,
			 board_ctx.canvas.height);
}

function adjust_shade(shade, delta, orig) {
    shade.h += delta.h;
    if (Math.abs(shade.h-orig.h) > 20 || shade.h >= 360 || shade.h <= 0) {
    	delta.h = 0 - delta.h;
    }

    shade.s += delta.s;
    if (shade.s >= 75 || shade.s <= 25) {
	delta.s = 0 - delta.s;
    }
	
    shade.l += delta.l;
    if (shade.l >= 75 || shade.l <= 40) {
	delta.l = 0 - delta.l;
    }
	
}


