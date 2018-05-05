var io = require('socket.io-client');

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
  

// example code from mr doob : http://mrdoob.com/lab/javascript/requestanimationframe/

var global = {
    grid: 0,
    smallblocks: 0,
    cellsize: 10,
    delaycount: 1,
    minplayers: 40,
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

var count = 0;

var direction = {stopped: -1, up: 1, down: 2, left: 3, right: 4};

var players = [];

var all_cells = [];

function new_player() {
    return {
	alive: 1,
	dir: direction.up,
	size: 30,
	position: {
	    x: Math.floor(Math.random() * dimension.width  / 2) + Math.floor(dimension.width / 4),
	    y: Math.floor(Math.random() * dimension.height / 2) + Math.floor(dimension.height / 4),
	},
	shade : {
	    r: Math.floor(Math.random()*256),
	    g: Math.floor(Math.random()*256),
	    b: Math.floor(Math.random()*256),
	},
	shade_delta : {
	    r: 0.1,
	    g: 0.1,
	    b: 0.1,
	},
	scale : 1.0,
	cells: [],
    };
}

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


    for (var i=0;i<dimension.width;i++) {
	all_cells[i]=[];
	for (j=0;j<dimension.height;j++) {
	    all_cells[i][j]=0;
	}
    }

    clear_all_cells();

    for (x=0;x<40;x++) {
	add_player();
    }

    viewport_player = players[0];

/*
    test = document.createElement( 'canvas' );
    test.width = dimension.width * global.cellsize;
    test.height = dimension.height * global.cellsize;
    test_ctx = test.getContext( '2d' );
    test_ctx.translate(test.width,test.height);
    test_ctx.rotate(Math.PI/5);
    draw_axes(test_ctx);
*/    

    map = document.createElement( 'canvas' );
    map.width = view.width * global.cellsize;
    map.height = view.height * global.cellsize;
    map_ctx = map.getContext( '2d' );
    map_ctx.imageSmoothingEnabled = false;

    board = document.createElement( 'canvas' );
    board.width = dimension.width * global.cellsize;
    board.height = dimension.height * global.cellsize;
    board_ctx = board.getContext( '2d' );
    board_ctx.strokeRect(0,0,board_ctx.canvas.width,board_ctx.canvas.height);

    viewport = document.createElement( 'canvas' );
    viewport.width = view.width * global.cellsize;
    viewport.height = view.height * global.cellsize;
    viewport_ctx = viewport.getContext( '2d' );
    viewport_ctx.strokeRect(0,0,viewport_ctx.canvas.width,viewport_ctx.canvas.height);
    viewport_ctx.imageSmoothingEnabled = false;

    board_ctx.strokeStyle = 'rgb(205,205,205)';

    document.body.appendChild( viewport );
    document.body.appendChild(document.createElement('br'));
    document.body.appendChild( map );
    document.body.appendChild(document.createElement('br'));
//    document.body.appendChild( board );
//    document.body.appendChild(document.createElement('br'));

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
}

function add_player() {
    players.push(new_player());
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

    if (players.length < global.minplayers) {
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

//    update_viewport_player();

}

function update_viewport_scale(p) {
    p.scale = 1 + Math.min(2,(p.cells.length / 1000));
}

function award_collision(killed,killer) {
    killer.size += killed.size;
    killed.size = 1;
    if (killed === viewport_player) {
	viewport_player = killer;
    }
}

function update_viewport_player(p) {
    var max = 0;

    for (var i in players) {
	if (players[i].size > max) {
	    viewport_player = players[i];
	    max = players[i].size;
	}
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
    
    p.position.x += delta.x;
    p.position.y += delta.y;

    if (p.position.x < 0) {
	p.position.x = 0;
	p.dir = direction.right;
    }

    if (p.position.y < 0) {
	p.position.y = 0;
	p.dir = direction.down;
    }

    if (p.position.x >= dimension.width) {
	p.position.x = dimension.width - 1;
	p.dir = direction.left;
    }

    if (p.position.y >= dimension.height) {
	p.position.y = dimension.height - 1;
	p.dir = direction.up;
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

    if (x < 0) {
	x = 0;
	}

    if (y < 0) {
	y = 0;
	}

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

//function draw_player(p) {
//    draw_cell(p.position,p.shade);
//    adjust_shade(p.shade,p.shade_delta);
//}

function populate_all_cells(p) {
    for (var i in p.cells) {
	all_cells[p.cells[i].x][p.cells[i].y] = p;
    }
}

function refresh_player(p) {
    for (var i in p.cells) {
	if (i == (p.cells.length - 1)) {
	    draw_cell(p.cells[i],{r:0,g:0,b:0});
	}
	else {
	    draw_cell(p.cells[i],p.shade);	
	}
//	adjust_shade(p.shade,p.shade_delta);
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
    var color = 'rgb('+shade.r+','+shade.g+','+shade.b+')';

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

    return c;
}

function adjust_shade(shade, delta) {
    shade.r += delta.r;
    if (shade.r >= 235 || shade.r <= 50) {
	delta.r = 0 - delta.r;
    }

    shade.g += delta.g;
    if (shade.g >= 235 || shade.g <= 50) {
	delta.g = 0 - delta.g;
    }

    shade.b += delta.b;
    if (shade.b > 235 || shade.b <= 50) {
	delta.b = 0 - delta.b;
    }
}


