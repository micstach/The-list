$(document).ready(function(){
  $(".locale").click(function(event) {
    $.post("/locale/" + $(this).attr('data-locale'), function(data) {
      location.reload();
    });
    event.preventDefault() ;
  })
})
