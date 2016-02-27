
function finishesWith(referenceValue, endingValue)
{
	if (referenceValue.toString().length >= endingValue.toString().length) {
		var start = referenceValue.toString().length - endingValue.toString().length ;
		var length = endingValue.toString().length ;
		var a = referenceValue.toString().substring(start, referenceValue.toString().length) ;
		var b = endingValue.toString() ;
		return a === b ;	
	}
	else {
		return false ;
	}
}

function finishesWithArray(referenceValue, arr)
{
	return arr.filter(function(endingValue) { return finishesWith(referenceValue, endingValue); }).length > 0 ;
}

function getTimeString(timestamp)
{
	var now = Date.now() ;
	var time = new Date(timestamp) ;

	var seconds = Math.floor((now - timestamp) / 1000) ;
	var minutes = Math.floor(seconds / 60) ;
	var hours = Math.floor(minutes / 60) ;
	var days = Math.floor(hours / 24) ;
	var weeks = Math.floor(days / 7) ;

	var timeString = 'error';

	if (days > 0) {
		if (days == 1) {
			timeString = days + ' dzień temu';
		} 
		else {
			timeString = days + ' dni temu' ;
		}
	}
	else if (hours > 0) {
		if (hours == 1) {
			timeString = 'godzinę temu' ;
		} 
		else if (finishesWithArray(hours, [0, 1, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19])) {
			timeString = hours + ' godzin temu' ;
		}
		else if (finishesWithArray(hours, [2, 3, 4])) {
			timeString = hours + ' godziny temu'
		}
	}
	else if (minutes > 0) {
		if (minutes == 1) {
			timeString = 'minutę temu';
		} 
		else if (finishesWithArray(minutes, [0, 1, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19])) {
			timeString = minutes + ' minut temu';
		}
		else if (finishesWithArray(minutes, [2, 3, 4])) {
			timeString = minutes + ' minuty temu';
		}
	}
	else if (seconds < 15) {
		timeString = 'przed chwilą' ;
	} 
	else if (seconds <= 30) {
		timeString = 'pół minuty temu' ;
	} 
	else {
		timeString = 'prawie minutę temu' ;
	}
	
	return timeString ;
}

$(document).ready(function() {
	
	$('.message-toggle').click(function () {
		var status = $(this).prop('checked');
		var id = $(this).attr('data-message-id');
		var userid = $(this).attr('data-user-id');
		var action = (status ? 'checked' : 'unchecked');

		$.ajax({
			url: "/api/user/" + userid + "/message/" + action + "/" + id,
			method: 'PUT'
		}).done(function(){
			//$('#'+id).css('background-color', 'rgba(225,225,245,1)');
		}) ;
	}) ;

	$('.message-time').each(function(){
		var timestamp = parseInt($(this).text()) ;
		$(this).text(getTimeString(timestamp)) ;
	}) ;

	$('.message-delete').click(function(){
		var messageId = $(this).attr('data-message-id') ;
		$('#accept-remove-message').attr('data-user-id', $(this).attr('data-user-id'));		
		$('#accept-remove-message').attr('data-message-id', messageId);
		$('#message-text').html($('#'+messageId).find('.message-main').html());
		$('#remove-message').modal();
	}) ;

    $('#accept-remove-message').click(function(){
		var userid = $(this).attr('data-user-id') ;
		var messageid = $(this).attr('data-message-id');

		$.ajax({
			url: "/api/user/" + userid + "/message/delete/" + messageid,
			method: 'POST'
		}).done(function(){
			$('#'+messageid).hide();
		})
    });

	$('.message-removeall').click(function(e){
		$('#remove-all').modal();
		e.preventDefault();
	}) ;

    $('#accept-remove-all').click(function(){
		$.ajax({
			url: $(this).attr('data-uri'),
			method: 'POST'
		}).done(function(){
			$('.list-group').empty();
			$('.items-counter').each(function(){
				$(this).text('0');
			}) ;
		}) ;
    });

    $('.application-list').css('margin-top', $('.application-header').outerHeight() + 'px') ;

    $('.toolbox-menu').click(function(e){
    	$('div.toolbox').toggleClass('toolbox-full');

    	if ($('div.toolbox').hasClass('toolbox-full'))
    		$('.utilities').show();
    	else
    		$('.utilities').hide();
    	
    	e.preventDefault() ;
    });

    $('.utilities').each(function(){
    	$(this).hide();
    });

    // enable tooltips
    $('[data-toggle="tooltip"]').tooltip() ;
}) ;