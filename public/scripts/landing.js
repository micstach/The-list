$(document).ready(function(){
	$(".locale").click(function(event) {
		$.post("/locale/" + $(this).attr('data-locale'), function(data) {
			location.reload();
			console.log("page should reload") ;
		});
		event.preventDefault() ;
	}) ;
});