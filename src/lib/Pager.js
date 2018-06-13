const nodemailer = require("nodemailer");
const debug = require("debug");

module.exports = class Pager {

    constructor(callback,keep) {
	this.transporter = nodemailer.createTransport({
	    host: "smtp.gmail.com",
	    port: 465,
	    secure: true, // true for 465, false for other ports
	    auth: {
		user: "mauidude@gmail.com",
		pass: "bjtu dkmd oiru upey",
	    }
	});

	this.mailOptions = {
            from: '"Eric Olson" <olson@mauicomputing.com>',
            to: "8082832088@messaging.sprintpcs.com",
            subject: "[splines.io]",
            text: "",
//            html: "<b>Hello world?</b>" // html body
	};
    }

    send(message) {
	this.mailOptions.text = message;

	this.transporter.sendMail(this.mailOptions, (error, info) => {
            if (error) {
		return console.log(error);
            }
            console.log("Message sent: %s", info.messageId);
	});
    }
};


