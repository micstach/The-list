$(document).ready(function() {
	
	$('.message-toggle').click(function () {
		var checked = $(this).prop('checked');
		var id = $(this).attr('data-message-id');
		var userid = $(this).attr('data-user-id');
		var action = checked ? 'checked' : 'unchecked';

		$.ajax({
			url: "/api/user/" + userid + "/message/" + action + "/" + id,
			method: 'PUT'
		}).done(function(){
			console.log('toggle ' + checked) ;
		}) 

		console.log('toggle ' + checked) ;
	}) ;

	$('.message-time').each(function(){
		var timestamp = parseInt($(this).text()) ;
		var time = new Date(timestamp) ;

		$(this).text(time.toLocaleString()) ;
	}) ;

	$('.message-delete').click(function(){
		var userid = $(this).attr('data-user-id') ;
		var messageid = $(this).attr('data-message-id');

		$.ajax({
			url: "/api/user/" + userid + "/message/delete/" + messageid,
			method: 'POST'
		}).done(function(){
			$('#'+messageid).hide();
		})
	}) ;
}) ;