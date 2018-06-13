const constant = require('constant.js');
const globals = require('globals.js');
const Player = require('Player.js');
const babynames = require('babynames.js');

let robot_counter = 0;

// RobotPlayer Constructor

module.exports = class RobotPlayer extends Player{
    constructor() {
	super();
	this.is_robot = true;
	this.id = "R"+robot_counter++;
	this.name = babynames[Math.floor(Math.random()*babynames.length)];
	this.dash = (Math.random() > 0.6) ? 1 : 0;
	this.prob_left_right = 0.5;
	this.prob_random_turn = Math.random() / 8 + 0.02;
    }

    turn() {
	let rnd = Math.random();
	
	let new_pos = this.predict_position(2);
	
	let new_dir = this.dir;
	
	let c = this.get_collision_object(new_pos.x,new_pos.y);
	
	let force_turn = (c===false || (c && c!==this));
	let random_turn = (Math.random() <= this.prob_random_turn);

	if (force_turn || random_turn) {
	    if (Math.random() < this.prob_left_right) {
		new_dir = this.turn_left(this.dir);
	    }
	    else {
		new_dir = this.turn_right(this.dir);
	    }
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
