var io = require('socket.io-client');
var socket;

var logger = function(...args) {
    if (console && console.log) {
        console.log(...args);
    }
};

// requestAnim shim layer by Paul Irish
    window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame    || 
              window.oRequestAnimationFrame      || 
              window.msRequestAnimationFrame     || 
              function(/* function */ callback, /* DOMElement */ element){
                window.setTimeout(callback, 1000 / 60);
              };
    })();
  

var global = {
    grid: 0,
    smallblocks: 0,
    cellsize: 10,
    delaycount: 0,
    minplayers: 1,
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

var board;
var board_ctx;
var viewport;
var viewport_ctx;
var map;
var map_ctx;
var radar;
var radar_ctx;

var direction = {stopped: -1, up: 1, down: 2, left: 3, right: 4};

var players = [];

var all_cells = [];

var viewport_player;

var direction_delta = {stopped: { x: 0,  y: 0  },
		       up:      { x: 0,  y: -1 },
		       down:    { x: 0,  y: 1  },
		       left:    { x: -1, y: 0  },
		       right:   { x: 1,  y: 0  },
		      };

init();
animate();

function init() {


    if (!socket) {
        socket = io({query:"type=player"});
        setupSocket(socket);
	socket.emit("client_setup");
    }

    // Initialize "all cells" array for collision detection

    for (var i=0;i<dimension.width;i++) {
	all_cells[i]=[];
	for (var j=0;j<dimension.height;j++) {
	    all_cells[i][j]=0;
	}
    }

    // Add initial players to the players[] array

    for (var x=0;x<100;x++) {
	add_player();
    }

    // Pick someone to be the player shown on the viewport

    viewport_player = players[0];

    // Canvases

/*
    test = document.createElement( 'canvas' );
    test.width = dimension.width * global.cellsize;
    test.height = dimension.height * global.cellsize;
    test_ctx = test.getContext( '2d' );
    test_ctx.translate(test.width,test.height);
    test_ctx.rotate(Math.PI/5);
    draw_axes(test_ctx);
*/    

    // A view of the entire board, same size as the viewport

    map = document.createElement( 'canvas' );
    map.width = view.width * global.cellsize;
    map.height = view.height * global.cellsize;
    map_ctx = map.getContext( '2d' );
    map_ctx.imageSmoothingEnabled = false;

    // The entire playing field

    board = document.createElement( 'canvas' );
    board.width = dimension.width * global.cellsize;
    board.height = dimension.height * global.cellsize;
    board_ctx = board.getContext( '2d' );
    board_ctx.strokeRect(0,0,board_ctx.canvas.width,board_ctx.canvas.height);

    // The current player's view into the board

    viewport = document.createElement( 'canvas' );
    viewport.width = view.width * global.cellsize;
    viewport.height = view.height * global.cellsize;
    viewport_ctx = viewport.getContext( '2d' );
    viewport_ctx.strokeRect(0,0,viewport_ctx.canvas.width,viewport_ctx.canvas.height);
    viewport_ctx.imageSmoothingEnabled = false;

    document.body.appendChild( viewport );
    document.body.appendChild(document.createElement('br'));
    document.body.appendChild( map );
    document.body.appendChild(document.createElement('br'));


    // The board is not displayed (the map shows it shrunk down)

//    document.body.appendChild( board );
//    document.body.appendChild(document.createElement('br'));

    // Draw the grid, if enabled

    board_ctx.strokeStyle = 'rgb(205,205,205)';

    if (global.grid) {
	board_ctx.beginPath();
	for (x = 0; x <= dimension.width; x++) {
	    board_ctx.moveTo(x*global.cellsize,0);
	    board_ctx.lineTo(x*global.cellsize,dimension.height*global.cellsize);
	}
	for (y = 0; y <= dimension.height; y++) {
	    board_ctx.moveTo(0,y*global.cellsize);
	    board_ctx.lineTo(dimension.width*global.cellsize,y*global.cellsize);
	}
	board_ctx.closePath();
	board_ctx.stroke();
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
        leaderboard = data.leaderboard;
    });

    socket.on('serverMSG', function (data) {
    });

    socket.on('s_update_players', function (data) {
	logger("Got s_update_players",data);
	update_players(data);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (userData, foodsList, massList, virusList) {
        var playerData;
        for(var i =0; i< userData.length; i++) {
            if(typeof(userData[i].id) == "undefined") {
                playerData = userData[i];
                i = userData.length;
            }
        }
        if(global.playerType == 'player') {
            var xoffset = player.x - playerData.x;
            var yoffset = player.y - playerData.y;

            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            player.xoffset = isNaN(xoffset) ? 0 : xoffset;
            player.yoffset = isNaN(yoffset) ? 0 : yoffset;
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
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
        reason = data;
        global.kicked = true;
        socket.close();
    });
}

}

// Player Constructor

function Player() {
    this.alive = 1;
    this.dir = direction.up;
    this.speed = 1.0;
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

// Player factory

function new_player() {
    return {
	alive: 1,
	dir: direction.up,
	speed: 1.0,
	size: 100,
	position: {
	    x: Math.floor(Math.random() * (dimension.width-50)) + 25,
	    y: Math.floor(Math.random() * (dimension.height-50)) + 25,
	},
	shade : {
	    h: Math.floor(Math.random()*360),
	    s: 50,
	    l: 50,
	},
	shade_delta : {
	    h: 3.0,
	    s: 1.0,
	    l: 0.5,
	},
	scale : 1.0,
	cells: [],
    };
}

function add_player() {
    players.push(new Player());
}

function draw_axes(ctx) {
    for (x = -1000; x <= 1000; x+=10) {
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
    for (y = -1000; y <= 1000; y+=10) {
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

function animate() {
    requestAnimFrame( animate );

    while (players.length < global.minplayers) {
	add_player();
    }

    if (global.delaycount && delaycount++%global.delaycount) {
	return;
    }

    clear_board();
    clear_all_cells();

    var i;

    for (i in players) {
	update_viewport_scale(players[i]);
	populate_all_cells(players[i]);
    }

    for (i in players) {
	if (players[i].alive) {
	    move_player(players[i]);
	    var killer = check_collision(players[i]);
	    if (killer) {
		award_collision(players[i],killer);
//		players[i].cells = [];
		players[i].alive = 0;
	    }
	}
    }

    remove_dead_players();

    for (i in players) {
	shift_player(players[i]);
	refresh_player(players[i]);
    }

//    draw_all_cells();

    update_viewport(viewport_player);

    update_map(viewport_player);

}

function update_viewport_scale(p) {
    p.scale = 1; // + Math.min(2,(p.cells.length / 1000));
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

function shift_player(p) {

    p.size += 0.01;
    
    p.cells.push({x: p.position.x,
		  y: p.position.y
		 });

    if (p.cells.length >= p.size) {
	var tail_position = p.cells.shift();
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

function move_player(p) {

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
    
    p.position.x += delta.x * p.speed;
    p.position.y += delta.y * p.speed;

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
	for (j=0;j<dimension.height;j++) {
	    all_cells[i][j]=0;
	}
    }
}

function update_viewport(p) {
    var width = dimension.width;
    var height = dimension.height;

    var x = p.position.x - p.scale*view.width/2;
    var y = p.position.y - p.scale*view.height/2;

/*    if (x < 0) {
	x = 0;
	}

    if (y < 0) {
	y = 0;
	}
*/
    viewport_ctx.resetTransform(); // Not implemented in all browsers
    viewport_ctx.clearRect( 0, 0, viewport_ctx.canvas.width, viewport_ctx.canvas.height);
    viewport_ctx.strokeRect(0, 0, viewport_ctx.canvas.width, viewport_ctx.canvas.height);
    viewport_ctx.strokeStyle = 'rgb(0,0,0)';

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
    else if (p.dir == direction.up) {
	viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == direction.left) {
	viewport_ctx.translate(width_pixel,0);
	viewport_ctx.rotate(Math.PI/2);
	viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == direction.right) {
	viewport_ctx.translate(0,height_pixel);
	viewport_ctx.rotate(3*Math.PI/2);
	viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == direction.down) {
	viewport_ctx.translate(width_pixel,height_pixel);
	viewport_ctx.rotate(Math.PI);
	viewport_ctx.drawImage(board,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
}

function update_map(p) {
    var width = map_dim.width;
    var height = map_dim.height;

    map_ctx.clearRect( 0, 0, map_ctx.canvas.width, map_ctx.canvas.height);
    map_ctx.strokeRect(0, 0, map_ctx.canvas.width, map_ctx.canvas.height);
    map_ctx.strokeStyle = 'rgb(0,0,0)';

    map_ctx.drawImage(board,
		      0,0,
		      board.width*global.cellsize,
		      board.height*global.cellsize,
		      0,0,
		      map.width*global.cellsize,
		      map.height*global.cellsize
		     );
}

function populate_all_cells(p) {
    for (var i in p.cells) {
	all_cells[p.cells[i].x][p.cells[i].y] = p;
    }
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

    for (var i in p.cells) {
	if (i == (p.cells.length - 1)) {
	    draw_cell(p.cells[i],{h:0,l:0,s:0});
	}
	else {
	    draw_cell(p.cells[i],shade);	
	}
	adjust_shade(shade,shade_delta,p.shade);
    }
}

function draw_all_cells() {
    for (var i=0;i<dimension.width;i++) {
	for (j=0;j<dimension.height;j++) {
	    if (all_cells[i][j]) {
		draw_cell({x:i,y:j},{r:128,g:128,b:128});
	    }
	}
    }
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

function clear_board() {
    board_ctx.clearRect(0,0,board_ctx.canvas.width,
			 board_ctx.canvas.height);
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


