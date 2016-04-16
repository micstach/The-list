exports.resources = {
	succcesPrefix: "Brawo!",
	emailSendSuccessMessage: function(email) {
		return "E-mail z zaproszeniem został wysłany na adres <email>.".replace("<email>", email) ;
	},
	checkEmail: "Sprawdż skrzynkę pocztową aby kontynuować rejestrację.",
	emailInvalidAddress: function(email){
		return "Błędny adres email <email>".replace("<email>", email) ;
	},
	errorPrefix: "Ups!",
	emailInvalidRegisterationLink: "Nieaktualny link do rejestracji.",
	emailGetNewRegistrationLink: "Wygeneruj nowy link podając swój adres e-mail, a następnie kliknij przycisk poniżej.",	
	labelEmailAddress: "Adres e-mail",
	inputEmailAddressPlaceholder: "Podaj adres e-mail",
	labelUserName: "Nazwa użytkownika",
	inputUserNamePlaceholder: "Podaj nazwę użytkownika",
	labelPassword: "Hasło",
	inputPasswordPlaceholder: "Podaj hasło",
	inputPasswordRepeatPlaceholder: "Powtórz hasło",
	buttonSignIn: "Zarejestruj się",
	buttonSendRegisterationLink: "Wyślij link do rejestracji"
}