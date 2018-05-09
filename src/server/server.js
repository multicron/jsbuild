/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');
var debug = require('debug')('blubio');

var logger = function(...args) {
    debug(...args);
};

logger("server.js starting up");

// Agar Game settings
var conf = {
    "host": "0.0.0.0",
    "port": 3000,
    "logpath": "logger.php",
    "foodMass": 1,
    "fireFood": 20,
    "limitSplit": 16,
    "defaultPlayerMass": 10,
	"virus": {
    "fill": "#33ff33",
  	"stroke": "#19D119",
		"strokeWidth": 20,
		"defaultMass": {
            "from": 100,
            "to": 150
        },
		"splitMass": 180
	},
    "gameWidth": 5000,
    "gameHeight": 5000,
    "adminPass": "DEFAULT",
    "gameMass": 20000,
    "maxFood": 1000,
    "maxVirus": 50,
    "slowBase": 4.5,
    "logChat": 0,
    "networkUpdateFactor": 40,
    "maxHeartbeatInterval": 5000,
    "foodUniformDisposition": true,
    "virusUniformDisposition": false,
    "newPlayerInitialPosition": "farthest",
    "massLossRate": 1,
    "minMassLoss": 50,
    "mergeTimer": 15,
    "sqlinfo":{
      "connectionLimit": 100,
      "host": "DEFAULT",
      "user": "root",
      "password": "DEFAULT",
      "database": "DEFAULT",
      "debug": false
    }
};

// Import utilities.
var util = require('./lib/util');

// Import quadtree.
var quadtree = require('simple-quadtree');

var tree = quadtree(0, 0, conf.gameWidth, conf.gameHeight);

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

// From Agar
var users = [];
var massFood = [];
var food = [];
var virus = [];
var sockets = {};

var leaderboard = [];
var leaderboardChanged = false;

var V = SAT.Vector;
var C = SAT.Circle;

var players = [];
var robot_counter = 0;

function add_player() {
    var player = new Player();
    player.id = "R"+robot_counter++;
    players.push(player);
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
    this.socket = undefined;
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

    for (var x=0;x<3;x++) {
	add_player();
    }
}

var initMassLog = util.log(conf.defaultPlayerMass, conf.slowBase);

app.use(express.static(__dirname + '/../client'));

function movePlayer(player) {
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

function tick_game() {

    while (players.length < global.minplayers) {
	add_player();
    }

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
    }

    for (i in players) {
	if (players[i].socket) {
	    send_players_update(players[i]);
	}
    }
}

function send_players_update(recipient) {
    for (var i in players) {
	var p = players[i];
	recipient.socket.emit('s_update_players',{
	    id:           p.id,
	    alive:        p.alive,
	    dir:          p.dir,
	    speed:        p.speed,
	    size:         p.size,
	    position:     p.position,
	    shade:        p.shade,
	    shade_delta:  p.shade.delta,
	    scale:        p.scale,
	    cells:        p.cells,
	});
    }
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
	for (var j=0;j<dimension.height;j++) {
	    all_cells[i][j]=0;
	}
    }
}

io.on('connect', function (socket) {
    logger('A user connected!', socket.handshake);

    var type = socket.handshake.query.type;

    // Initialize new player

    var radius = util.massToRadius(conf.defaultPlayerMass);
    var position = conf.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

    var cells = [];
    var massTotal = 0;
    if(type === 'player') {
        cells = [{
            mass: conf.defaultPlayerMass,
            x: position.x,
            y: position.y,
            radius: radius
        }];
        massTotal = conf.defaultPlayerMass;
    }

    var currentPlayer = new Player();
    currentPlayer.socket = socket;
    currentPlayer.id = socket.id;
    players.push(currentPlayer);

    socket.on('gotit', function (player) {
        logger('[INFO] Player ' + player.name + ' connecting!');

        if (util.findIndex(users, player.id) > -1) {
            logger('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            logger('[INFO] Player ' + player.name + ' connected!');
            sockets[player.id] = socket;

            var radius = util.massToRadius(conf.defaultPlayerMass);
            var position = conf.newPlayerInitialPosition == 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

            player.x = position.x;
            player.y = position.y;
            player.target.x = 0;
            player.target.y = 0;
            if(type === 'player') {
                player.cells = [{
                    mass: conf.defaultPlayerMass,
                    x: position.x,
                    y: position.y,
                    radius: radius
                }];
                player.massTotal = conf.defaultPlayerMass;
            }
            else {
                 player.cells = [];
                 player.massTotal = 0;
            }
            player.hue = Math.round(Math.random() * 360);
            currentPlayer = player;
            currentPlayer.lastHeartbeat = new Date().getTime();
            users.push(currentPlayer);

            io.emit('playerJoin', { name: currentPlayer.name });

            socket.emit('gameSetup', {
                gameWidth: conf.gameWidth,
                gameHeight: conf.gameHeight
            });
            logger('Total players: ' + users.length);
        }

    });

    socket.on('pingcheck', function () {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', function (data) {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', function () {
    });

    socket.on('disconnect', function () {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        logger('[INFO] User ' + currentPlayer.name + ' disconnected!');

        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
    });

    socket.on('playerChat', function(data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        if (conf.logChat === 1) {
            logger('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0,35)});
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

function tickPlayer(currentPlayer) {
    if(currentPlayer.lastHeartbeat < new Date().getTime() - conf.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + conf.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }

    movePlayer(currentPlayer);

    function funcFood(f) {
        return SAT.pointInCircle(new V(f.x, f.y), playerCircle);
    }

    function deleteFood(f) {
        food[f] = {};
        food.splice(f, 1);
    }

    function eatMass(m) {
        if(SAT.pointInCircle(new V(m.x, m.y), playerCircle)){
            if(m.id == currentPlayer.id && m.speed > 0 && z == m.num)
                return false;
            if(currentCell.mass > m.masa * 1.1)
                return true;
        }
        return false;
    }

    function check(user) {
        for(var i=0; i<user.cells.length; i++) {
            if(user.cells[i].mass > 10 && user.id !== currentPlayer.id) {
                var response = new SAT.Response();
                var collided = SAT.testCircleCircle(playerCircle,
                    new C(new V(user.cells[i].x, user.cells[i].y), user.cells[i].radius),
                    response);
                if (collided) {
                    response.aUser = currentCell;
                    response.bUser = {
                        id: user.id,
                        name: user.name,
                        x: user.cells[i].x,
                        y: user.cells[i].y,
                        num: i,
                        mass: user.cells[i].mass
                    };
                    playerCollisions.push(response);
                }
            }
        }
        return true;
    }

    function collisionCheck(collision) {
        if (collision.aUser.mass > collision.bUser.mass * 1.1  && collision.aUser.radius > Math.sqrt(Math.pow(collision.aUser.x - collision.bUser.x, 2) + Math.pow(collision.aUser.y - collision.bUser.y, 2))*1.75) {
            logger('[DEBUG] Killing user: ' + collision.bUser.id);
            logger('[DEBUG] Collision info:');
            logger(collision);

            var numUser = util.findIndex(users, collision.bUser.id);
            if (numUser > -1) {
                if(users[numUser].cells.length > 1) {
                    users[numUser].massTotal -= collision.bUser.mass;
                    users[numUser].cells.splice(collision.bUser.num, 1);
                } else {
                    users.splice(numUser, 1);
                    io.emit('playerDied', { name: collision.bUser.name });
                    sockets[collision.bUser.id].emit('RIP');
                }
            }
            currentPlayer.massTotal += collision.bUser.mass;
            collision.aUser.mass += collision.bUser.mass;
        }
    }

    for(var z=0; z<currentPlayer.cells.length; z++) {
        var currentCell = currentPlayer.cells[z];
        var playerCircle = new C(
            new V(currentCell.x, currentCell.y),
            currentCell.radius
        );

        var foodEaten = food.map(funcFood)
            .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

        foodEaten.forEach(deleteFood);

        var massEaten = massFood.map(eatMass)
            .reduce(function(a, b, c) {return b ? a.concat(c) : a; }, []);

        var virusCollision = virus.map(funcFood)
           .reduce( function(a, b, c) { return b ? a.concat(c) : a; }, []);

        if(virusCollision > 0 && currentCell.mass > virus[virusCollision].mass) {
          sockets[currentPlayer.id].emit('virusSplit', z);
          virus.splice(virusCollision, 1);
        }

        var masaGained = 0;
        for(var m=0; m<massEaten.length; m++) {
            masaGained += massFood[massEaten[m]].masa;
            massFood[massEaten[m]] = {};
            massFood.splice(massEaten[m],1);
            for(var n=0; n<massEaten.length; n++) {
                if(massEaten[m] < massEaten[n]) {
                    massEaten[n]--;
                }
            }
        }

        if(typeof(currentCell.speed) == "undefined")
            currentCell.speed = 6.25;
        masaGained += (foodEaten.length * conf.foodMass);
        currentCell.mass += masaGained;
        currentPlayer.massTotal += masaGained;
        currentCell.radius = util.massToRadius(currentCell.mass);
        playerCircle.r = currentCell.radius;

        tree.clear();
        users.forEach(tree.put);
        var playerCollisions = [];

        var otherUsers =  tree.get(currentPlayer, check);

        playerCollisions.forEach(collisionCheck);
    }
}

function moveloop() {
    for (var i = 0; i < users.length; i++) {
        tickPlayer(users[i]);
    }
    for (i=0; i < massFood.length; i++) {
    }
}

function gameloop() {
    if (users.length > 0) {
        users.sort( function(a, b) { return b.massTotal - a.massTotal; });

        var topUsers = [];

        for (var i = 0; i < Math.min(10, users.length); i++) {
            if(users[i].type == 'player') {
                topUsers.push({
                    id: users[i].id,
                    name: users[i].name
                });
            }
        }
        if (isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
            leaderboard = topUsers;
            leaderboardChanged = true;
        }
        else {
            for (i = 0; i < leaderboard.length; i++) {
                if (leaderboard[i].id !== topUsers[i].id) {
                    leaderboard = topUsers;
                    leaderboardChanged = true;
                    break;
                }
            }
        }
        for (i = 0; i < users.length; i++) {
            for(var z=0; z < users[i].cells.length; z++) {
                if (users[i].cells[z].mass * (1 - (conf.massLossRate / 1000)) > conf.defaultPlayerMass && users[i].massTotal > conf.minMassLoss) {
                    var massLoss = users[i].cells[z].mass * (1 - (conf.massLossRate / 1000));
                    users[i].massTotal -= users[i].cells[z].mass - massLoss;
                    users[i].cells[z].mass = massLoss;
                }
            }
        }
    }
}

function log_status() {
    players.forEach( function (player) {
	logger("Player: ",player.id,player.alive,player.cells);
    });
}

function sendUpdates() {
    users.forEach( function(u) {

        // center the view if x/y is undefined, this will happen for spectators

        u.x = u.x || conf.gameWidth / 2;
        u.y = u.y || conf.gameHeight / 2;

	// This only updates stuff that's visible

        var visibleFood  = food
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - 20 &&
                    f.x < u.x + u.screenWidth/2 + 20 &&
                    f.y > u.y - u.screenHeight/2 - 20 &&
                    f.y < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleVirus  = virus
            .map(function(f) {
                if ( f.x > u.x - u.screenWidth/2 - f.radius &&
                    f.x < u.x + u.screenWidth/2 + f.radius &&
                    f.y > u.y - u.screenHeight/2 - f.radius &&
                    f.y < u.y + u.screenHeight/2 + f.radius) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleMass = massFood
            .map(function(f) {
                if ( f.x+f.radius > u.x - u.screenWidth/2 - 20 &&
                    f.x-f.radius < u.x + u.screenWidth/2 + 20 &&
                    f.y+f.radius > u.y - u.screenHeight/2 - 20 &&
                    f.y-f.radius < u.y + u.screenHeight/2 + 20) {
                    return f;
                }
            })
            .filter(function(f) { return f; });

        var visibleCells  = users
            .map(function(f) {
                for(var z=0; z<f.cells.length; z++)
                {
                    if ( f.cells[z].x+f.cells[z].radius > u.x - u.screenWidth/2 - 20 &&
                        f.cells[z].x-f.cells[z].radius < u.x + u.screenWidth/2 + 20 &&
                        f.cells[z].y+f.cells[z].radius > u.y - u.screenHeight/2 - 20 &&
                        f.cells[z].y-f.cells[z].radius < u.y + u.screenHeight/2 + 20) {
                        z = f.cells.lenth;
                        if(f.id !== u.id) {
                            return {
                                id: f.id,
                                x: f.x,
                                y: f.y,
                                cells: f.cells,
                                massTotal: Math.round(f.massTotal),
                                hue: f.hue,
                                name: f.name
                            };
                        } else {
                            //logger("Nombre: " + f.name + " Es Usuario");
                            return {
                                x: f.x,
                                y: f.y,
                                cells: f.cells,
                                massTotal: Math.round(f.massTotal),
                                hue: f.hue,
                            };
                        }
                    }
                }
            })
            .filter(function(f) { return f; });

        sockets[u.id].emit('serverTellPlayerMove', visibleCells, visibleFood, visibleMass, visibleVirus);
        if (leaderboardChanged) {
            sockets[u.id].emit('leaderboard', {
                players: users.length,
                leaderboard: leaderboard
            });
        }
    });
    leaderboardChanged = false;
}

init_game();

setInterval(moveloop, 1000 / 60);
setInterval(tick_game, 100);
setInterval(sendUpdates, 1000 / conf.networkUpdateFactor);
setInterval(log_status,5000);


// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || conf.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || conf.port;
http.listen( serverport, ipaddress, function() {
    logger('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
