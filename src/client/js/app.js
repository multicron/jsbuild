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
                window.setTimeout(callback, 100);
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
	socket.emit("c_setup");
    }

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
//	logger("Got s_update_players",data);
	players = data;
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
//    window.setTimeout(animate, 100);
    requestAnimFrame( animate );

    clear_board();

    for (var i in players) {
	refresh_player(players[i]);
    }

    viewport_player = players[0];

    update_viewport(viewport_player);

    update_map(viewport_player);

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


