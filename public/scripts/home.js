$(document).ready(function(){
	$(".locale").click(function(event) {
		$.post("/locale/" + $(this).attr('data-locale'), function(data) {
			location.reload();
		});
		event.preventDefault() ;
	}) ;

	$('[data-toggle="tooltip"]').tooltip() ;
	
	$('#message-create-text').attr('autocomplete','off');
})

$(window).resize(function() {
    repositionSearchBar(0) ;
    repositionSearchBar() ;
})