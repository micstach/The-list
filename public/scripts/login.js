$(document).ready(function(){
  $('.login-button').click(function(){
    var user = $('#user').val() ;
    var pwd = $('#pwd').val() ;
    
    // windows
    try {
      if (window['desktopClient_SetUserCredentials'] !== undefined)
        window['desktopClient_SetUserCredentials'](user, pwd);
    }
    catch (err) {}

    // osx
    try {
      nativeapi.setUserCredentials(JSON.stringify({user: user, pwd: pwd})) ;
    }
    catch (err) {
    }

    e.preventDefault();
  });

  $(".locale").click(function(event) {
    $.post("/locale/" + $(this).attr('data-locale'), function(data) {
      location.reload();
    });
    event.preventDefault() ;
  }) ;

});