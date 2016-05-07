exports.resources = {
	succcesPrefix: "Brawo!",
	emailSendSuccessMessage: function(email) {
		return "E-mail z łączem do rejestracji został wysłany na adres <email>.".replace("<email>", email) ;
	},
	checkEmail: "Sprawdż skrzynkę pocztową, postępuj zgodnie opisem aby kontynuować rejestrację.",
	emailInvalidAddress: "Błędny adres e-mail",
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
	buttonSendRegisterationLink: "Wyślij łacze do rejestracji",
	errorInvalidUserName: "Niepoprawna nazwa użytkownika",
	errorPasswordsDoesNotMatch: "Hasła nie pasują",
	errorUserNameExists: "Użytkownik o tej nazwie już istnieje",
	errorInvalidUserOrPassword: "Niepoprawna nazwa użytkownika lub hasło",
	errorPasswordNotSet: "Hasło nie ustawione",
	defaultProjectName: "Twój pierwszy projekt"
}