$(document).ready(function(){
  $('.retyped').on('paste', function(e){
    e.preventDefault();
  }) ;

  $(".locale").click(function(event) {
    $.post("/locale/" + $(this).attr('data-locale'), function(data) {
      location.reload();
    });
    event.preventDefault() ;
  }) ;
  
});