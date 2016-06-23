$(document).ready(function(){

	(function(){
		
		var dependency_array = [<%= deps %>];
		var keys_pressed = [];		
		var commands = [
			{key_seq: '70,73,68,68,73,67,72', name: 'fiddich'}, // fiddich
			{key_seq: '71,76,69,78,78', name: 'glenn'}, // glenn
			{key_seq: '69,88,73,84', name: 'exit'} // exit
		];
		var active_command = null;
		var sdk_toast_shown = false;
		var deps_shown = false;
		var sdk_desc = dependency_array.pop();

		// ============================
		// Create dependency list...
		// ============================

		var el = $('<div hidden></div>');
		$(el).attr({id: 'bba_sdk_dep_list'});
		$(el).css({
			position: 'fixed',
			display: 'none',
			top: '0px',
			left: '0px',
			width: '100%',
			height: 'auto',
			minHeight: '100%',			
			color: 'white',
			zIndex: 999			
		});		
		$(dependency_array).each(function(k, v){
			var parts = v.split(" ");

			var span_name = $('<span></span>');
			$(span_name).css('color', 'magenta');
			$(span_name).html(parts[0]);

			var span_version = $('<span></span>');
			$(span_version).css('color', 'green');
			$(span_version).html(parts[2]);

			var div = $('<div></div>')
			$(div).css({				
				transformOrigin: '0 0',
				background: '#000',
				opacity:' .9',
				padding: '5px',
				transition: 'all 1s'
			});			
			$(div).append(span_name).append(" | ").append(span_version);
			$(div).appendTo(el);
		});

		$(el).on('click', function(e){
			if(!active_command && commands[0].name == "exit"){				
				setCommand(commands[0]);
			}
			processRequest(e);			
		});
		
		$(document.body).append(el);

		// ======================
		// Create SDK toast...
		// ======================

		var toast = $('<div></div>');
		$(toast).attr('id', 'bba_sdk_toast');
		$(toast).css({
			position: 'fixed',
			top: '150%',
			right: '0px',
			padding: '10px 10px 0px 10px',
			background: '#5bbaf0',
			color: '#fff',
			boxShadow: '-2px -2px 25px #999',
			userSelect: 'none',
			webkitUserSelect: 'none',
			cursor: 'default',
			zIndex: 998,
			fontWeight: 'bold',
			transformOrigin: 'right bottom'		
		});		
		$(toast).bind('mousedown mouseout mouseleave click', function(e){
			if(e.type == "mousedown"){
				$(this).css({transform: 'scale(.95, .95)'});
			}else{
				$(this).css({transform: 'scale(1, 1)'});
			}
			if(e.type == "click"){				
				if(!active_command && commands[0].name == "glenn"){
					setCommand(commands[0]);
				}
				processRequest(e);
			}				
		});

		var title = $('<h1>SDK v</h1>');
		$(title).css({textTransform: 'none', fontWeight: 'bold', color: '#fff'});
		$(title).html("SDK v" + sdk_desc.split(" ")[2]);
		var img = $('<img />');
		$(img).attr(({draggable: 'false', ondragstart: 'return false'}));
		$(img).css({height: '200px', width: 'auto'});
		$(img).attr('src', 'images/bug.png');
		$(toast).append(title).append(img);
		
		$(document.body).append(toast);

		var isValidRequest = function(e){
			var key = e.which || e.keyCode || e.charCode;
			keys_pressed.push(key);
			var command = commands[0];
			var pattern = new RegExp("^" + keys_pressed.join());			
			if(command.key_seq.match(pattern)){
				// continue building sequence...				
			}else{
				// reset...				
				var last_key_pressed_pattern = new RegExp("^" + keys_pressed.pop());
				if(command.key_seq.match(last_key_pressed_pattern)){					
				    // if the last key pressed matches the first key in the sequence
				    // do not discard this key!					
					keys_pressed = [keys_pressed[0]];
				}else{
					keys_pressed = [];
				}				
			}
			if(command.key_seq === keys_pressed.join()){		
				setCommand(command);
			}
			return active_command;
		};

		var setCommand = function(cmd){
			active_command = cmd;
			commands.push(commands.shift());
			keys_pressed = [];
		}

		// \/\/\/\/\/\/\/
		// explosionJS
		// \/\/\/\/\/\/\/

		var explosionJS = {
			explode: function(){
				window.scrollTo(0, 0);
				$('#bba_sdk_dep_list').css({position: 'fixed'});
				var els = $('#bba_sdk_dep_list div');
				var max_delay = 1000;		
				$(els).each(function(key, val){
					delay = Math.floor(Math.random() * max_delay);					
					$(val).css({transition: 'all 1s'});				
					explosionJS.exit(val, delay);						
				});
				setTimeout(function(){
					$('#bba_sdk_dep_list').attr({hidden: 'hidden'});
					$('#bba_sdk_dep_list').css('display', 'none');
					$('body').css({overflowX: 'auto'});				
				}, max_delay + 330);

				$('#bba_sdk_toast').animate({top: '150%'}, 250);
				
			},
			exit: function(el, del){
				setTimeout(function(){				
					var top = Math.floor(Math.random() * 500);
					var deg = Math.floor(Math.random() * 20);
					var toggle = Math.round(Math.random());
					if(toggle == 1){
						top = top - (top * 2);
						deg = deg - (deg * 2);
					}						
					$(el).css({transform: 'translate(100%, ' + top + 'px) scale(4, 4) rotate(' + deg + 'deg)'});				
				}, del);				
			},
			enter: function(){
				var els = $('#bba_sdk_dep_list div');
				els.each(function(key, el){
					var top = Math.floor(Math.random() * 500);
					var deg = Math.floor(Math.random() * 20);
					var toggle = Math.round(Math.random());
					if(toggle == 1){
						top = top - (top * 2);
						deg = deg - (deg * 2);
					}						
					$(el).css({transition: 'all 0s', transform: 'translate(100%, ' + top + 'px) scale(4, 4) rotate(' + deg + 'deg)'});
				});
				setTimeout(function(){
					var els = $('#bba_sdk_dep_list div');
					els.each(function(key, el){
						$(el).css({transition: 'all 1s', transform: 'translate(0%, 0%) scale(1, 1) rotate(0deg)'});						
					});
				}, 20);
				setTimeout(function(){
					$('body').css({overflowX: 'hidden'});
					$('#bba_sdk_dep_list').css({position: 'absolute'});
				}, 1020);
			}
		}

		var showDeps = function(){			
			$('#bba_sdk_dep_list').removeAttr('hidden');
			$('#bba_sdk_dep_list').css('display', 'block');
			explosionJS.enter();
			deps_shown = true;
		};

		var showSDK = function(){			
			var top = $(window).innerHeight() - $('#bba_sdk_toast').innerHeight();
			$('#bba_sdk_toast').animate({top: top + 'px'}, 250);
			sdk_toast_shown = true;			
		}

		var explodify = function(){
			explosionJS.explode();
		}		

		var processRequest = function(e){
			var can_show = e.type == "click" || isValidRequest(e);			
			if(can_show){				
				switch(active_command.name){
					case "fiddich": showSDK(); active_command = null; break;
					case "glenn": showDeps(); active_command = null; break;
					case "exit": explodify(); active_command = null; break;
				}
			}	
		}

		// ======================================
		// Listen for key presses on the window
		// ======================================
		$(window).on('keydown', function(e){			
			processRequest(e);
		});

	})();

});
