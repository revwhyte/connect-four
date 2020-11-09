var express = require('express')
var dotenv = require('dotenv/config')

//chamada de lib responsavel pelos sockets
var app = express()

//chama arquivos dentro da pasta public
app.use(express.static('./public'))

//chama engine que renderiza pagina
app.set('view engine', 'jade')
app.set('views', './views')

//ao conectar no root, rederiza layout
app.route('/')
.get(function(req, res) {
	res.render('layout')
})

//inicializa servidor
var srv = app.listen(process.env.PORT, function() {
	console.log('Listening on '+process.env.PORT)
})

//ativa debugger
app.use('/peerjs', require('peer').ExpressPeerServer(srv, {
	debug: true
}))

// console.log(process.env.PORT)