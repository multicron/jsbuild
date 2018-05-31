const constant = require('constant.js');
const globals = require('globals.js');
const Player = require('Player.js');
const boynames = require('boynames.js');

let robot_counter = 0;

// RobotPlayer Constructor

module.exports = class RobotPlayer extends Player{
    constructor() {
	super();
	this.is_robot = true;
	this.id = "R"+robot_counter++;
	this.name = boynames[Math.floor(Math.random()*boynames.length)] + this.id;
	this.dash = (Math.random() > 0.6) ? 1 : 0;
    }

    turn() {
	let rnd = Math.random();
	
	let new_pos = this.predict_position(2);
	
	let new_dir = this.dir;
	
	let c = this.get_collision_object(new_pos.x,new_pos.y);
	
	let force_turn = (c===false || (c && c!==this));
	
	if (force_turn && rnd < 0.5) {
	    new_dir = this.turn_left(this.dir);
	}
	else if (force_turn && rnd >= 0.5) {
	    new_dir = this.turn_right(this.dir);
	}
	else if (rnd < 0.05) {
	    new_dir = this.turn_left(this.dir);
	}
	else if (rnd < 0.12) {
	    new_dir = this.turn_right(this.dir);
	}
	
	if (this.dir !== new_dir) {
	    this.dir = new_dir;
	    //	this.dash = 5;
	}
    }

    turn_right(dir) {
	switch (dir) {
	case constant.direction.up: 
	    return constant.direction.right;
	case constant.direction.left: 
	    return constant.direction.up;
	case constant.direction.down: 
	    return constant.direction.left;
	case constant.direction.right: 
	    return constant.direction.down;
	}
	return constant.direction.stopped;
    }
    
    turn_left(dir) {
	switch (dir) {
	case constant.direction.up: 
	    return constant.direction.left;
	case constant.direction.left: 
	    return constant.direction.down;
	case constant.direction.down: 
	    return constant.direction.right;
	case constant.direction.right: 
	    return constant.direction.up;
	}
	return constant.direction.stopped;
    }

};