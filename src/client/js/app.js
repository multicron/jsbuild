// jshint bitwise: true
// jshint browser: true
// jshint devel: true

'use strict';                                    // jshint ignore:line
const io = require('socket.io-client');          // jshint ignore:line
const global = require('../../lib/global.js');           // jshint ignore:line
const constant = require("../../lib/constant.js");       // jshint ignore:line
const Player = require("../../lib/Player.js");           // jshint ignore:line

var socket;

var logger = function(...args) {
    if (console && console.log) {
        console.log(...args);
    }
};

logger = function() {};

// requestAnim shim layer by Paul Irish
    window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame    || 
              window.oRequestAnimationFrame      || 
              window.msRequestAnimationFrame     || 
              function(/* function */ callback, /* DOMElement */ element){
                window.setTimeout(callback, 100);
              };
    })();
  
var board;
var board_ctx;
var viewport;
var viewport_ctx;
var map;
var map_ctx;
var radar;
var radar_ctx;

var players = [];

var all_cells = [];

var viewport_player;

init();
animate();

function player_by_id(id) {
//    logger("Player by id",id);
    var valid_players =  players.filter(function (p) {
	return p.id==id;
	});
    if (valid_players.length == 1) {
//	logger("Found player id in players[] array!",id);
	return valid_players[0];
    }
    else if (valid_players.length > 1) {
	logger("Multiple matches to id in players[] array!");
	return valid_players[0];
    }
    else {
	return undefined;
    }
}

function init() {


    if (!socket) {
        socket = io({query:"type=player",transports:['websocket']});
        setupSocket(socket);
	socket.emit("c_get_player_id");
    }

    const page = document.body;

    page.style.background = global.bgcolor;

    // Canvases

/*
    test = document.createElement( 'canvas' );
    test.width = global.world_dim.width * global.cellsize;
    test.height = global.world_dim.height * global.cellsize;
    test_ctx = test.getContext( '2d' );
    test_ctx.translate(test.width,test.height);
    test_ctx.rotate(Math.PI/5);
    draw_axes(test_ctx);
*/    

    // A map of the entire board, same size as the viewport

    map = document.createElement( 'canvas' );
    map.width = global.view_dim.width * global.cellsize;
    map.height = global.view_dim.height * global.cellsize;
    map_ctx = map.getContext( '2d' , {alpha: false});
    map_ctx.imageSmoothingEnabled = false;

    // A radar of the entire board, 1/16th the size of the viewport

    radar = document.createElement( 'canvas' );
    radar.width = (global.view_dim.width / 4) * global.cellsize;
    radar.height = (global.view_dim.height / 4) * global.cellsize;
    radar_ctx = radar.getContext( '2d' , {alpha: false});
    radar_ctx.imageSmoothingEnabled = true;

    // The entire playing field

    board = document.createElement( 'canvas' );
    board.width = global.world_dim.width * global.cellsize;
    board.height = global.world_dim.height * global.cellsize;
    board_ctx = board.getContext( '2d', {alpha: false});
    board_ctx.strokeRect(0,0,board_ctx.canvas.width,board_ctx.canvas.height);

    // The current player's view into the board

    viewport = document.createElement( 'canvas' );
    viewport.id = "viewport";
    viewport.width = global.view_dim.width * global.cellsize;
    viewport.height = global.view_dim.height * global.cellsize;
    viewport.style.width = '99%';
    viewport.style.height = '99%';
    viewport.style.border = '1px solid black';
    viewport.style.background = global.bgcolor;
    viewport_ctx = viewport.getContext( '2d', {alpha: false});
    viewport_ctx.imageSmoothingEnabled = false;

    page.appendChild( viewport );
    page.appendChild(document.createElement('br'));
    page.appendChild( radar );
    page.appendChild(document.createElement('br'));
    page.appendChild( map );
    page.appendChild(document.createElement('br'));


    // The board is not displayed (the map shows it shrunk down)

//    page.appendChild( board );
//    page.appendChild(document.createElement('br'));

    // Draw the grid, if enabled

    board_ctx.strokeStyle = 'rgb(205,205,205)';

    if (global.grid) {
	board_ctx.beginPath();
	for (var x = 0; x <= global.world_dim.width; x++) {
	    board_ctx.moveTo(x*global.cellsize,0);
	    board_ctx.lineTo(x*global.cellsize,global.world_dim.height*global.cellsize);
	}
	for (var y = 0; y <= global.world_dim.height; y++) {
	    board_ctx.moveTo(0,y*global.cellsize);
	    board_ctx.lineTo(global.world_dim.width*global.cellsize,y*global.cellsize);
	}
	board_ctx.closePath();
	board_ctx.stroke();
    }

    $(window).keypress(log_event);
    $(window).keydown(key_down);
    $(window).keyup(log_event);
    $(window).mouseout(log_event);
    $(window).mousemove(log_event);

//    window.setInterval(request_player_update, 50);

    window.setInterval(request_timestamp,100);
}

function mouse_move(event) {
    logger("Mouse Move");
    logger("Mouse", event.pageX,event.pageY);
    var pt = get_mouse_pos(viewport, event);
    logger("MousePos", pt);
    var new_dir = mouse_pos_to_dir(pt);
    var old_dir = viewport_player.dir;
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

    logger("Keydown");
    logger("Key", event.which);
    var new_dir = keycode_to_dir(event.which);
    logger("Direction", new_dir);

    if (new_dir) {
	event.preventDefault();
	logger("Sending direction change to",new_dir);
	socket.emit('c_change_direction',new_dir);
    }
}

function log_event(event) {
    logger(event);
}

function get_mouse_pos(canvas, event) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        y: (event.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    };
}

function mouse_pos_to_dir(passed_point) {
    var pt = {x: passed_point.x,
	      y: passed_point.y
	     };
    
    var center = {
	x: viewport.width / 2,
	y: viewport.height / 2
    };

    var tolerance = {
	x: 5,
	y: 5
    };

    pt.x -= center.x;
    pt.y -= center.y;

    logger("Centered", pt.x, pt.y);

    if (pt.x + tolerance.x < 0 && pt.x < pt.y) return constant.direction.left;
    if (pt.x - tolerance.x > 0 && pt.x > pt.y) return constant.direction.right;
    if (pt.y + tolerance.y < 0 && pt.x >= pt.y) return constant.direction.up;
    if (pt.y - tolerance.y > 0 && pt.x <= pt.y) return constant.direction.down;

    return pt;
}

function setupSocket(socket) {
    socket.on('pongcheck', function () {
    });

    socket.on('connect_failed', function () {
        socket.close();
        global.disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        global.disconnected = true;
    });

    socket.on("server_setup", function() {
	logger("Got server_setup");
	socket.emit("client_setup");
    });

    socket.on('welcome', function (data) {
	logger("Got welcome "+data);
        socket.emit('gotit');
    });

    socket.on('gameSetup', function(data) {
	logger("Got gamesetup");
    });

    socket.on('playerDied', function (data) {
	logger("Got playerDied");
    });

    socket.on('playerDisconnect', function (data) {
    });

    socket.on('playerJoin', function (data) {
    });

    socket.on('leaderboard', function (data) {
//        leaderboard = data.leaderboard;
    });

    socket.on('serverMSG', function (data) {
    });

    socket.on('s_update_players', function (data) {
//	logger("Got s_update_players");
	players = data;
    });

    socket.on('player_died', function () {
        global.gameStart = false;
        global.died = true;
        window.setTimeout(function() {
            document.getElementById('gameAreaWrapper').style.opacity = 0;
            document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
            global.died = false;
            if (global.animLoopHandle) {
                window.cancelAnimationFrame(global.animLoopHandle);
                global.animLoopHandle = undefined;
            }
        }, 2500);
    });

    socket.on('player_kicked', function (data) {
        global.gameStart = false;
        global.kicked = true;
        socket.close();
    });
}

function draw_axes(ctx) {
    for (var x = -1000; x <= 1000; x+=10) {
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
    for (var y = -1000; y <= 1000; y+=10) {
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

var delaycount = 0;

function request_player_update() {
    socket.emit('c_request_player_update');
}

function request_timestamp() {
    socket.emit('c_timestamp', Date.now());
}

function animate() {
    window.requestAnimFrame( animate );
    //    socket.emit('c_request_player_update');

    if (0) {
	socket.emit('c_latency', Date.now(), function(startTime) {
	    var latency = Date.now() - startTime;
	    logger("Latency to server is ",latency);
	});
    }

    clear_board();

    for (var i=0; i<players.length; i++) {
	refresh_player(players[i]);
    }

    viewport_player = player_by_id(socket.id);

//    logger("Viewport player id",viewport_player.id);

    if (viewport_player) {
	update_viewport(viewport_player);

	update_map(viewport_player);

	update_radar(viewport_player);
    }

}

function update_viewport(p) {
    var update_viewport_start = Date.now();

    var width = global.world_dim.width;
    var height = global.world_dim.height;

    var x = p.position.x - p.scale*global.view_dim.width/2;
    var y = p.position.y - p.scale*global.view_dim.height/2;

/*    if (x < 0) {
	x = 0;
	}

    if (y < 0) {
	y = 0;
	}
*/
    viewport_ctx.resetTransform(); // Not implemented in all browsers
    viewport_ctx.strokeStyle = 'rgb(0,0,0)';
    viewport_ctx.clearRect( 0, 0, viewport_ctx.canvas.width, viewport_ctx.canvas.height);

    // Clip out the portion of the canvas corresponding to where the player is on the board;

    var x_pixel = x * global.cellsize;
    var y_pixel = y * global.cellsize;

    var width_pixel = viewport_ctx.canvas.width;
    var height_pixel = viewport_ctx.canvas.height;

    if (!global.rotateview) {

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
    }
    else if (p.dir == constant.direction.up) {
	viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == constant.direction.left) {
	viewport_ctx.translate(width_pixel,0);
	viewport_ctx.rotate(Math.PI/2);
	viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == constant.direction.right) {
	viewport_ctx.translate(0,height_pixel);
	viewport_ctx.rotate(3*Math.PI/2);
	viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == constant.direction.down) {
	viewport_ctx.translate(width_pixel,height_pixel);
	viewport_ctx.rotate(Math.PI);
	viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    logger("Viewport update took ",Date.now() - update_viewport_start, "ms");
}

function update_map(p) {
    var width = global.map_dim.width;
    var height = global.map_dim.height;

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

function update_radar(p) {
    var width = global.world_dim.width/32;
    var height = global.world_dim.height/32;

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

function refresh_player(p) {
//    adjust_shade(p.shade,p.shade_delta,p.shade);

    var shade = {
	h:p.shade.h,
	l:p.shade.l,
	s:p.shade.s,
    };

    var shade_delta = {
	h:p.shade_delta.h,
	l:p.shade_delta.l,
	s:p.shade_delta.s,
    };

    var lines = cells_to_lines(p.cells);

    if (0) {
	for (var i=0; i < (p.cells.length - 1); i++) {
	    draw_cell(p.cells[i],{h:0,l:50,s:50});	
	    //	adjust_shade(shade,shade_delta,{h:0,l:50,s:50});
	}
    }

    for (var j=0; j<lines.length; j++) {
	draw_line(lines[j],shade);
    }
    
    
   draw_head(p.cells[p.cells.length - 1]);
    
}

function cells_to_lines (cells) {

    if (cells.length <= 0) return;

    var start_x,start_y;
    var end_x,end_y;
    var start, end;
    var lines = [];
    var line;

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

    var horiz = false;
    var vert = false;

    for (var i = 1 ; i < cells.length; i++) {
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
    var color = 'hsl('+shade.h+','+shade.l+'%,'+shade.s+'%)';

    board_ctx.fillStyle = color;

    if (global.smallblocks) {
	board_ctx.fillRect((cell.x*global.cellsize)+1,
			    (cell.y*global.cellsize)+1,
			    global.cellsize-2,
			    global.cellsize-2);
    }
    else {
	board_ctx.fillRect((cell.x*global.cellsize),
			    (cell.y*global.cellsize),
			    global.cellsize,
			    global.cellsize);
    }
}

function draw_head(cell) {
    board_ctx.fillStyle = global.headcolor;

    if (global.smallblocks) {
	board_ctx.fillRect((cell.x*global.cellsize)+1,
			    (cell.y*global.cellsize)+1,
			    global.cellsize-2,
			    global.cellsize-2);
    }
    else {
	board_ctx.fillRect((cell.x*global.cellsize),
			    (cell.y*global.cellsize),
			    global.cellsize,
			    global.cellsize);
    }
}

function draw_line(line,shade) {
    var color = 'hsl('+shade.h+','+shade.l+'%,'+shade.s+'%)';

    board_ctx.fillStyle = color;

//    logger("Line ",line.start.x,line.start.y,"to",line.end.x,line.end.y);

    var line_left = Math.min(line.end.x,line.start.x);
    var line_top  = Math.min(line.end.y,line.start.y);

    var width = Math.abs((line.end.x - line.start.x))+1;
    var height = Math.abs((line.end.y - line.start.y))+1;

    board_ctx.fillRect(line_left*global.cellsize,
		       line_top*global.cellsize,
		       width * global.cellsize,
		       height * global.cellsize);
}

function clear_board() {
    board_ctx.fillStyle = global.bgcolor;
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


