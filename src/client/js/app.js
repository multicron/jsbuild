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

var cellsize = 20;

var board = {
    width: 30,
    height: 30,
};
var view = {
    width: 10,
    height: 10,
};

var canvas;
var canvas_ctx;
var count = 0;
var viewport;

var direction = {stopped: -1, up: 1, down: 2, left: 3, right: 4};

var players = [];

for (x=0;x<1;x++) {
players.push({
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
	g: 0,
	b: 0,
    },
});
}
var direction_delta = {stopped: { x: 0,  y: 0  },
		       up:      { x: 0,  y: -1 },
		       down:    { x: 0,  y: 1  },
		       left:    { x: -1, y: 0  },
		       right:   { x: 1,  y: 0  },
		      };

init();
animate();

function init() {

    test = document.createElement( 'canvas' );
    test.width = board.width * cellsize;
    test.height = board.height * cellsize;
    test_ctx = test.getContext( '2d' );
    test_ctx.translate(test.width,test.height);
    test_ctx.rotate(Math.PI/5);
    draw_axes(test_ctx);
    

    canvas = document.createElement( 'canvas' );
    canvas.width = board.width * cellsize;
    canvas.height = board.height * cellsize;
    canvas_ctx = canvas.getContext( '2d' );

    viewport = document.createElement( 'canvas' );
    viewport.width = view.width * cellsize;
    viewport.height = view.height * cellsize;
    viewport_ctx = viewport.getContext( '2d' );

    viewport_ctx.strokeRect(0,0,viewport_ctx.canvas.width,viewport_ctx.canvas.height);
    viewport_ctx.imageSmoothingEnabled = false;

    canvas_ctx.strokeStyle = 'rgb(25,25,25)';

    document.body.appendChild( test );
    document.body.appendChild( viewport );
    document.body.appendChild( canvas );

    canvas_ctx.beginPath();
    for (x = 0; x <= board.width; x++) {
	canvas_ctx.moveTo(x*cellsize,0);
	canvas_ctx.lineTo(x*cellsize,board.height*cellsize);
    }
    for (y = 0; y <= board.height; y++) {
	canvas_ctx.moveTo(0,y*cellsize);
	canvas_ctx.lineTo(board.width*cellsize,y*cellsize);
    }
    canvas_ctx.stroke();

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


function animate() {
    requestAnimFrame( animate );
    for (x=0 ; x<1; x++) {
	for (var i in players) {
	    move_player(players[i]);
	    draw_player(players[i]);
	}
    }
    update_viewport(players[0]);
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
    }

    if (p.position.y < 0) {
	p.position.y = 0;
    }

    if (p.position.x >= board.width) {
	p.position.x = board.width - 1;
    }

    if (p.position.y >= board.height) {
	p.position.y = board.height - 1;
    }
}

function direction_to_rotation(dir) {
    switch (dir) {
    case direction.up:
	return 0;
    case direction.right:
	return Math.PI/2;
    case direction.left:
	return Math.PI*3/2;
    case direction.down:
	return Math.PI;
    default:
	return 0;
    }
}

function old_update_viewport(p) {
    viewport_ctx.resetTransform();
    viewport_ctx.clearRect(0, 0, viewport_ctx.canvas.width, viewport_ctx.canvas.height);
//    viewport_ctx.rotate(Math.PI/10*(count++%20));
    viewport_ctx.drawImage(canvas,0,0);
}

function update_viewport(p) {
    var width = board.width;
    var height = board.height;

    var x = p.position.x - view.width/2;
    var y = p.position.y - view.height/2;

    if (x < 0) {
	x = 0;
	}

    if (y < 0) {
	y = 0;
	}

    viewport_ctx.resetTransform();
    viewport_ctx.clearRect( 0, 0, viewport_ctx.canvas.width, viewport_ctx.canvas.height);
    viewport_ctx.strokeRect(0, 0, viewport_ctx.canvas.width, viewport_ctx.canvas.height);
    viewport_ctx.strokeStyle = 'rgb(0,0,0)';

    // Clip out the portion of the canvas corresponding to where the player is on the board;

    var x_pixel = x * cellsize;
    var y_pixel = y * cellsize;

    var width_pixel = viewport_ctx.canvas.width;
    var height_pixel = viewport_ctx.canvas.height;

    var rotation = direction_to_rotation(p.dir);

    console.log("X "+x_pixel+" Y "+x_pixel+" Width "+width_pixel+" Height "+height_pixel);

    if (p.dir == direction.up) {
	viewport_ctx.drawImage(canvas,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == direction.left) {
	viewport_ctx.translate(width_pixel,0);
	viewport_ctx.rotate(Math.PI/2);
	viewport_ctx.drawImage(canvas,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == direction.right) {
	viewport_ctx.translate(0,height_pixel);
	viewport_ctx.rotate(3*Math.PI/2);
	viewport_ctx.drawImage(canvas,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
    else if (p.dir == direction.down) {
	viewport_ctx.translate(width_pixel,height_pixel);
	viewport_ctx.rotate(Math.PI);
	viewport_ctx.drawImage(canvas,x_pixel,y_pixel,width_pixel,height_pixel,0,0,width_pixel,height_pixel);
    }
}

function draw_player(p) {
    var color = 'rgba('+p.shade.r+','+p.shade.g+','+p.shade.b+',1)';

    canvas_ctx.fillStyle = color;

    adjust_shade(p.shade,p.shade_delta);

    canvas_ctx.fillRect((p.position.x*cellsize)+1,
			(p.position.y*cellsize)+1,
			cellsize-2,
			cellsize-2);
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


