
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

function escapeHtmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

var elements = {} ;
function resizeTextArea(className) {
	if (elements[className] === undefined)
		elements[className] = $(className) ;
	
	var element = elements[className] ;
	element.height(0) ;
	var scrollHeight = element[0].scrollHeight ;
	element.height(scrollHeight);
}

function repositionSearchBar(width) {
	if (width === undefined) {
		var tagsButtonWidth = $('.tags-button').outerWidth(true) ;
		var tagsSelectedWidth = $('.tags-selected').outerWidth(true) ;
		var searchBoxWidth = $('.search-box').outerWidth(true) ;

		var searchBarWidth = $('#content-filter-box').innerWidth() ;

		var diff = searchBarWidth - (tagsButtonWidth + tagsSelectedWidth);

		$('.search-box').outerWidth(diff - 20) ;
	}
	else
	{
		$('.search-box').outerWidth(width) ;	
	}
}

function replaceCharWithTags(text, char, begin, end)
{
  	var textToReplace = [] ;
	var preformatedTags = [] ;

	var idx = 0 ;
	idx = text.indexOf(char, idx) ;

	while (idx !== -1) {

		var add = false ;
		if (preformatedTags.length%2 == 0) {
			if (idx == 0) {
				add = true ;
			}
			else if (text[idx-1] == ' ' || 
				     text[idx-1] == '\n' ||
				     text[idx-1] == '>') {
				add = true ;
			}
		}
		else {
			if (idx == text.length - 1) {
				add = true ;
			} 
			else if (text[idx+1] == ' ' || 
				     text[idx+1] == '\n' ||
				     text[idx+1] == '<') {
				add = true ;
			}
		}

		if (add)
			preformatedTags.push(idx) ;

		idx = text.indexOf(char, idx + 1) ;
	}

	if (preformatedTags.length > 0 && preformatedTags.length % 2 === 0) 
	{
	  for (var i=0; i<preformatedTags.length; i+=2)
	  {
	    var originalTextBlock = text.slice(preformatedTags[i], preformatedTags[i+1] + char.length) ;

	    var transformedTextBlock = originalTextBlock ;
	    var index = 0 ;
	    transformedTextBlock = transformedTextBlock.substr(0, index)  + begin + transformedTextBlock.substr(index+1, transformedTextBlock.length-(index+1));
	    index = transformedTextBlock.length - 1;
	    transformedTextBlock = transformedTextBlock.substr(0, index)  + end + transformedTextBlock.substr(index+1, transformedTextBlock.length-(index+1));

      	textToReplace.push({src: originalTextBlock, dst: transformedTextBlock});
	  }
	}	

	textToReplace.forEach(function(transformation) {
		text = text.split(transformation.src).join(transformation.dst) ;
	}) ;

	return text ;
}

function detectBoldText(text) {
	return replaceCharWithTags(text, '*', '<b>', '</b>') ;
}

function detectItalicText(text) {
	return replaceCharWithTags(text, '_', '<i>', '</i>') ;
}

function detectPreformatedText(text) {

  	var textToReplace = [] ;
	var preformatedTags = [] ;
	var re = new RegExp('```', 'gi');
	while (re.exec(text))
	  preformatedTags.push(re.lastIndex - ('```'.length)) ;

	if (preformatedTags.length > 0 && preformatedTags.length % 2 === 0) {
	  for (var i=0; i<preformatedTags.length; i+=2)
	  {
	    var originalTextBlock = text.slice(preformatedTags[i], preformatedTags[i+1] + '```'.length) ;

	    var transformedTextBlock = originalTextBlock ;
	    var index = 1 ;
	    transformedTextBlock = transformedTextBlock.substr(0, index)  + 'A' + transformedTextBlock.substr(index+1, transformedTextBlock.length-(index+1));
	    index = transformedTextBlock.length - 2;
	    transformedTextBlock = transformedTextBlock.substr(0, index)  + 'B' + transformedTextBlock.substr(index+1, transformedTextBlock.length-(index+1));

	    if (transformedTextBlock[3] == '\n')
	    {
	      index = 3 ;
	      transformedTextBlock = transformedTextBlock.substr(0, index)  + '' + transformedTextBlock.substr(index+1, transformedTextBlock.length-(index+1));
	    }

      var singleLine = originalTextBlock.substr(3, originalTextBlock.length - 6).indexOf('\n') === -1 ; 

      if (singleLine)
	      transformedTextBlock = transformedTextBlock.replace("`A`", "<div class='preformated-text-inline'>");
      else
        transformedTextBlock = transformedTextBlock.replace("`A`", "<div class='preformated-text'>");

	    transformedTextBlock = transformedTextBlock.replace("`B`", "</div>") ;

      textToReplace.push({src: originalTextBlock, dst: transformedTextBlock});
	  }
	}	

	textToReplace.forEach(function(transformation) {
	text = text.replace(transformation.src, transformation.dst) ;
	text = text.replace('</div>\n', '</div>');
	}) ;

	return text ;
}

function removeLeadingSpaces(text) {
	var lines = text.split('\n') ;
	var out = '' ;

	lines.forEach(function(src) {
		var i = 0;

		while (src[i] === ' ' && i < src.length) {
			out += '&nbsp;' ;
			i++
		}

		out += src.substr(i, src.length - i) ;
		out += '\n';		
	}) ;

	return out ;
}

function removeElementFromArray(array, value)
{
	var i = array.indexOf(value) ;
	if (i !== -1) {
		array.splice(i, 1) ;
	}
}

$(document).ready(function() {
    $('[data-toggle="tooltip"]').tooltip() ;
    
    $('#message-create-text').attr('autocomplete','off');

}) ;

$(window).resize(function() {
    repositionSearchBar(0) ;
    repositionSearchBar() ;
}) ;