(function() {
//verifica se browser é capaz de rodar webRTC. Senao, para
	if(!util.supports.data) {
		$('.no-support').show().next().hide()
		return
	}

	var peer = null
	var peerId = null //id do proprio peer
	var conn = null //conexao
	var opponent = {
		peerId: null //id do peer oponente
	}
	var turn = false //variavel que indica se eh sua vez de jogar
	var ended = false //verifica se o jogo encerrou ou nao
	var grid = [ //simulador da grid do jogo
		[],
		[],
		[],
		[],
		[],
		[],
		[]
	]

	function begin() {
		//verifica envio de dados (nome 'data') do adversario
		conn.on('data', function(data) {
			switch(data[0]) {
				case 'move':
					//se nao for seu turno, ignora
					if(turn) {
						return
					}
					//se foi um clique invalido, ignora
					var i = data[1]
					if(grid[i].length == 6) {
						return
					}
					//adiciona id do oponente no campo da grid equivalente
					grid[i].push(opponent.peerId)
					$('#game .grid tr:eq('+(6-grid[i].length)+') td:eq('+i+') .slot').addClass('filled-opponent')
					//aciona propria vez de jogar
					$('#game .alert p').text('Sua vez!')
					turn = true
					//verifica se o jogo encerrou
					process()

					break
			}
		})
		//caso o oponente feche a tela de jogo
		conn.on('close', function() {
			if(!ended) {
				$('#game .alert p').text('Opponent forfeited!')
			}
			turn = false
		})
		//caso ocorra erro na conexao
		peer.on('error', function(err) {
			alert(''+err)
			turn = false
		})
	}

	function process() {
		//verifica se o jogo encerrou ou nao
		var endedBy = null
		for(var i = 0; i < grid.length && !ended; i++) {
			for(var j = 0; j < 6; j++) {
				//se não ouve jogadas na celula, ou se a celula é invalida, continua
				if(typeof grid[i][j] === 'undefined') {
					continue
				}
				//verifica jogos vencidos na horizontal
				var match = true
				for(var k = 0; k < 4; k++) {
					if(grid[i][j] !== grid[i][j+k]) {
						match = false
					}
				}
				if(match) {
					endedBy = grid[i][j]
					ended = true
					for(var k = 0; k < 4; k++) {
						$('#game .grid tr:eq('+(6-(j+k)-1)+') td:eq('+i+') .slot').addClass('highlight')
					}
					break
				}
				//verifica jogos vencidos na vertical
				match = true
				for(var k = 0; k < 4; k++) {
					if(i+k >= 7 || grid[i+k] && grid[i][j] !== grid[i+k][j]) {
						match = false
					}
				}
				if(match) {
					endedBy = grid[i][j]
					ended = true
					for(var k = 0; k < 4; k++) {
						$('#game .grid tr:eq('+(6-j-1)+') td:eq('+(i+k)+') .slot').addClass('highlight')
					}
					break
				}
				//verifica jogos vencidos na diagonal principal
				match = true
				for(var k = 0; k < 4; k++) {
					if(i+k >= 7 || j+k >= 6 || grid[i][j] !== grid[i+k][j+k]) {
						match = false
					}
				}
				if(match) {
					endedBy = grid[i][j]
					ended = true
					for(var k = 0; k < 4; k++) {
						$('#game .grid tr:eq('+(6-(j+k)-1)+') td:eq('+(i+k)+') .slot').addClass('highlight')
					}
					break
				}
				//verifica jogos vencidos na diagonal secundaria
				match = true
				for(var k = 0; k < 4; k++) {
					if(i-k < 0 || grid[i][j] !== grid[i-k][j+k]) {
						match = false
					}
				}
				if(match) {
					endedBy = grid[i][j]
					ended = true
					for(var k = 0; k < 4; k++) {
						$('#game .grid tr:eq('+(6-(j+k)-1)+') td:eq('+(i-k)+') .slot').addClass('highlight')
					}
					break
				}
			}
		}
		//se o jogo encerrou, mostra vencedor
		if(ended) {
			$('#game .grid').addClass('ended')
			if(endedBy == peerId) {
				$('#game .alert p').text('Você venceu!')
			} else {
				$('#game .alert p').text('Você perdeu.')
			}
			turn = false
		}
		//verifica se houve empate
		var draw = true
		$.each(grid, function(i, c) {
			if(c.length < 6) {
				draw = false
			}
		})
		if(draw) {
			$('#game .alert p').text('Empate!')
			turn = false
		}
	}
//listener para cliques validos dentro da grid do jogo
	$('#game .grid tr td').on('click', function(event) {
		event.preventDefault()
		//se nao for seu turno, ignora
		if(!turn) {
			return
		}
		//se todas as celulas daquelas colunas ja forma preenchidas, ignora
		var i = $(this).index()
		if(grid[i].length == 6) {
			return
		}
		//a jogada eh valida, entao poe proprio id na grid no campo equivalente, preenche
		//visualmente, informa jogada ao oponente, e verifica se o jogo acabou
		grid[i].push(peerId)
		$('#game .grid tr:eq('+(6-grid[i].length)+') td:eq('+i+') .slot').addClass('filled')

		$('#game .alert p').text("Esperando jogada do oponente")
		turn = false

		conn.send(['move', i])

		process()
	})

	function initialize() {
		//inicializa peer, seta host, porta, caminho para debuger, e valor de debug
		//(3 - mostrar todas as opcoes
		peer = new Peer('', {
			host: location.hostname,
			port: location.port || (location.protocol === 'https:' ? 443 : 80),
			path: '/peerjs',
			debug: 3
		})
		//quando entra na rede, adiciona proprio id aa peerID
		peer.on('open', function(id) {
			peerId = id
		})
		//caso receba mensagens de erro na conexao, exibe em tela
		peer.on('error', function(err) {
			alert(''+err)
		})

		//caso haja muita demora em se comunicar com o amigo, verifica se ainda esta conectado.
		// Heroku HTTP routing timeout rule (https://devcenter.heroku.com/articles/websockets#timeouts) workaround
		function ping() {
			console.log(peer)
			peer.socket.send({
				type: 'ping'
			})
			setTimeout(ping, 16000)
		}
		ping()
	}

	function start() {
		//primeiro jogador inicializa jogo.
		initialize()
		//inicializa informacoes de jogo em tela
		peer.on('open', function() {
			$('#game .alert p').text('Aguardando oponente').append($('<span class="pull-right"></span>').text('Peer ID: '+peerId))
			$('#game').show().siblings('section').hide()
			alert('Seu amigo pode jogar com você usando o ID: '+peerId)
		})
		//quando um amigo se conecta na rede
		peer.on('connection', function(c) {
			if(conn) {
				//caso um terceiro tente se conectar na mesma rede, ignora
				c.close()
				return
			}
			//adiciona conexao aa variavelglobal
			conn = c
			//voce foi o primeiro jogador, logo eh sua vez de jogar
			turn = true
			$('#game .alert p').text('Sua vez')
			begin()
		})
	}

	function join() {
		initialize()
		peer.on('open', function() {
			//quando inicia conexao, recebe (no prompt) id do oponente. cria uma conexao
			//confiavel com ele
			var destId = prompt("ID do oponente:")
			conn = peer.connect(destId, {
				reliable: true
			})
			//quando inicia conexao, espera jogada do oponente
			conn.on('open', function() {
				opponent.peerId = destId
				$('#game .alert p').text("Esperando jogada do oponente")
				$('#game').show().siblings('section').hide()
				turn = false
				begin()
			})
		})
	}

	$('a[href="#start"]').on('click', function(event) {
		event.preventDefault()
		//ao clicar no botao iniciar, comeca o jogo (vc eh o primeiro)
		start()
	})
	$('a[href="#join"]').on('click', function(event) {
		event.preventDefault()
		//quando voce conecta a um joo ja iniciado. voce eh o segundo a comecar
		join()
	})

	$('#game .grid td').on('mouseenter', function() {
		$('#game .grid tr td:nth-child('+($(this).index()+1)+')').addClass('hover')
	})
	$('#game .grid td').on('mouseleave', function() {
		$('#game .grid tr td:nth-child('+($(this).index()+1)+')').removeClass('hover')
	})

})()
