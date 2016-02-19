$(document).ready(function() {
	
	$('.message-toggle').click(function () {
		var checked = $(this).prop('checked');
		var id = $(this).attr('data-message-id');
		var userid = $(this).attr('data-user-id');
		var action = checked ? 'checked' : 'unchecked';

		$.ajax({
			url: "/api/user/" + userid + "/message/" + id + "/" + action,
			method: 'PUT'
		}).done(function(){
			console.log('message ' + action) ;
		})

		console.log('toggle ' + checked) ;
	}) ;

}) ;