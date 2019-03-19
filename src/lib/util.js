/* jslint node: true */

'use strict';

module.exports = {
    bless: function(object,type) {
//      Not Approved:
//	Object.setPrototypeOf(object,type);

	let new_object = Object.create(type);
	Object.assign(new_object,object);
	return new_object;
    }
};


