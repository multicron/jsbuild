const constant = require('constant.js');
const globals = require('globals.js');

// Observer Constructor

module.exports = class Observer {

    // Note that some of these items copied from player are objects and must not be modified
    // or they will change the data in the original players array.

    constructor(player) {
	this.id = player.id;
	this.name = player.name;
	this.alive = false;
	this.size = 0;
	this.dash = 0;
	this.position = {
	    x: player.position.x,
	    y: player.position.y,
	};
	this.shade  = {
	    h: player.shade.h,
	    s: player.shade.s,
	    l: player.shade.l
	};
	this.scale  = player.scale;
    }
};
