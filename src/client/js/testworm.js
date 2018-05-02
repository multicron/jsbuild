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

var board = {
    width: 100,
    height: 75,
};
var canvas;
var context;
var count = 0;

var direction = {stopped: -1, up: 1, down: 2, left: 3, right: 4};

var player = {
    dir: direction.up,
    position: {
	x: Math.floor(board.width / 2),
	y: Math.floor(board.height / 2),
    },
    shade : {
	r: Math.floor(Math.random()*256),
	g: Math.floor(Math.random()*256),
	b: Math.floor(Math.random()*256),
    },
    shade_delta : {
	r: 1,
	g: 2,
	b: 3,
    },
};

var players = [];

players.push(clone(player),clone(player),clone(player));

var direction_delta = {stopped: { x: 0,  y: 0  },
		       up:      { x: 0,  y: -1 },
		       down:    { x: 0,  y: 1  },
		       left:    { x: -1, y: 0  },
		       right:   { x: 1,  y: 0  },
		      };

var cellsize = 10;

init();
animate();

function init() {

    canvas = document.createElement( 'canvas' );
    canvas.width = 1000;
    canvas.height = 750;

    context = canvas.getContext( '2d' );

    context.strokeStyle = 'rgb(25,25,25)';

    document.body.appendChild( canvas );

    context.beginPath();
    for (x = 0; x < board.width; x++) {
	context.moveTo(x*cellsize,0);
	context.lineTo(x*cellsize,board.height*cellsize);
    }
    for (y = 0; y < board.height; y++) {
	context.moveTo(0,y*cellsize);
	context.lineTo(board.width*cellsize,y*cellsize);
    }
    context.stroke();

}

function animate() {
    requestAnimFrame( animate );
    for (var player in players) {
	draw(player);
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

function draw(p) {

    var delta = {
	x: 0,
	y: 0,
    };
    
    var rnd = Math.random();

    if (rnd < 0.1) {
	p.dir = turn_left(p.dir);
    }
    else if (rnd < 0.2) {
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
    }

    if (p.position.y < 0) {
	p.position.y = 0;
    }

    if (p.position.x >= board.width) {
	p.position.x = board.width;
    }

    if (p.position.y >= board.height) {
	p.position.y = board.height;
    }

    var color = 'rgb('+p.shade.r+','+p.shade.g+','+p.shade.b+')';

    context.fillStyle = color;

    adjust_shade(p.shade,p.shade_delta);

/*
    context.beginPath();
    context.arc( x, y, cellsize, 0, Math.PI * 2, true );
    context.closePath();
    context.fill();
*/
    context.fillRect(p.position.x*cellsize+1,p.position.y*cellsize+1,cellsize-2,cellsize-2);

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


