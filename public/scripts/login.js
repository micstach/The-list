$(document).ready(function(){
  console.log('login page loaded');

  $('.login-button').click(function(){
    var user = $('#user').val() ;
    var pwd = $('#pwd').val() ;
    
    try {
      if (window['desktopClient_SetUserCredentials'] !== undefined)
        window['desktopClient_SetUserCredentials'](user, pwd);
    }
    catch(err){}
  });

  $('#retyped-email').onpaste(function(e){
    e.preventDefault();
  }) ;
});