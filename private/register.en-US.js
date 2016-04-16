exports.resources = {
	succcesPrefix: "Great!",
	emailSendSuccessMessage: function(email) {
		return "Invitation e-mail was sent to <email>.".replace("<email>", email) ;
	},
	checkEmail: "Please check e-mail box to continue registeration.",
	emailInvalidAddress: function(email){
		return "Inavlid e-mail address <email>".replace("<email>", email) ;
	},
	errorPrefix: "Ouch!",
	emailInvalidRegisterationLink: "Invalid registeration link.",
	emailGetNewRegistrationLink: "Generate a new registeration link by entering your e-mail address, than click button below.",	
	labelEmailAddress: "E-mail address",
	inputEmailAddressPlaceholder: "Enter e-mail address",
	labelUserName: "User name",
	inputUserNamePlaceholder: "Enter user name",
	labelPassword: "Password",
	inputPasswordPlaceholder: "Enter password",
	inputPasswordRepeatPlaceholder: "Re-enter password",
	buttonSignIn: "Sign up",
	buttonSendRegisterationLink: "Send registeration link"
}