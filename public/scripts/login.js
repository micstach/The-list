$(document).ready(function(){
  $('.login-button').click(function(){
    var user = $('#user').val() ;
    var pwd = $('#pwd').val() ;
    
    try {
      if (window['desktopClient_SetUserCredentials'] !== undefined)
        window['desktopClient_SetUserCredentials'](user, pwd);
    }
    catch(err){}
  });
});