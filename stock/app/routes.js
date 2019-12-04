// load up the user model
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
var dbconfig = require('../config/database');
var connection = mysql.createConnection(dbconfig.connection);

connection.query('USE ' + dbconfig.database);
module.exports = function (app, passport) {
	var axios = require('axios');
	var moment = require('moment');
	//var queries = require('./queries');

	// normal routes ===============================================================


	app.post('/add_bank_account', isLoggedIn, (req, res) => {
		connection.query("Insert into bank(`userid`,`account_no`,`routing_no`) values('" +req.user.idUser+ "','" +req.body.bank_acc_no+ "','" +req.body.routing + "')",
		function (error, results, fields) {
			if (error) throw error;
	
			console.log('Inserting bank details');
	
			res.redirect('/profile');
			
		});
	});


	app.post('/update_profile', isLoggedIn, (req, res) => {
		connection.query("update users set `address`='" +req.body.address+ "',`email`='" +req.body.email+ "' where `idUser`='" +req.user.idUser+"'",
		function (error, results, fields) {
			if (error) throw error;
	
			console.log('Updating profile');
	
			res.redirect('/profile');
			
		});
	});

	app.post('/add_money', isLoggedIn, (req, res) => {
		connection.query("update users set `balance`=`balance`+'" +req.body.balance+ "' where `idUser`='" +req.user.idUser+"'",
		function (error, results, fields) {
			if (error) throw error;
	
			console.log('Updating balance');
	
			res.redirect('/profile');
			
		});
	});

	app.post('/update_schedule', isLoggedIn, (req, res) => {
		connection.query("update users set `balance`=`balance`+''" +req.body.balance+ "where `idUser=''" +req.user.idUser,
		function (error, results, fields) {
			if (error) throw error;
	
			console.log('Updating balance');
	
			res.redirect('/profile');
			
		});
	});

	// show the home page (will also have our login links)
	app.get('/', function (req, res) {
		res.render('index.ejs');
	});

	// PROFILE SECTION =========================


	app.get('/profile', function (req, res) {
		return_data = {}
		const id=req.user.idUser;
		query1 = "select username, address, email, balance from users where `idUser`=" +id;
		query2 = "select account_no from bank where `userid`=" +id;
		connection.query(query1, {}, function(err, results) {
			profile={
                username:results[0].username,
                address:results[0].address,
                email:results[0].email,
                balance:results[0].balance
            };
			return_data.user = profile;
			//console.log(return_data);
			
			connection.query(query2, {}, function(err, results) {
				var accounts=[];
				console.log(results);
				for (let i = results.length - 1; i >= 0; i--) {
					accounts.push(results[i].account_no);
				}
				bank={
					account_nos:accounts
				};
				return_data.banks = bank;
				console.log(return_data);
				res.render('profile.ejs', return_data);
			
				
			});
		});
	});



	// STOCK SEARCH =========================
	app.get('/search', isLoggedIn, function (req, res) {
		res.render('search.ejs');
	});

	// SHOW STOCK PRICES
	app.get('/show/:stock/:time', isLoggedIn, function (req, res) {
		var stock = req.params.stock;
		var time = req.params.time;

		var date = moment();

		if (time === 'wk') {
			time = 'This Week';
			date = date.startOf('week');
		} else if (time === '1wk') {
			time = 'Past Week';
			date = date.subtract(7, 'days');
		} else if (time === 'mo') {
			time = 'This Month';
			date = date.startOf('month');
		} else if (time === 'yr') {
			time = 'This Year';
			date = date.startOf('year');
		} else {
			time = 'Past 5 Years';
			date = date.subtract(5, 'years');
		}
		console.log(`${time} ISO: ` + date.toISOString());
		//get price info from exchange app.
		function getCurrentPrice() {
			const url = 'http://localhost:8081/api/getLatestStockPrice';
			const data = {
				symbol: stock
			};

			return axios({
				method: 'post',
				url: url,
				data: data
			});
		}
		function getPriceHistory() {
			const url = 'http://localhost:8081/api/getStockHistory';
			const data = {
				symbol: stock,
				timestamp: date.toISOString()
			};

			return axios({
				method: 'post',
				url: url,
				data: data
			});
		}
		axios.all([getCurrentPrice(), getPriceHistory()]).then((result) => {
			console.log('curr: ', result[0].data);
			console.log('history: ', result[1].data);

			let prices = [];
			let dates = [];

			for (let i = result[1].data.history.length - 1; i >= 0; i--) {
				prices.push(result[1].data.history[i].price.toFixed(2));
				dates.push(moment(result[1].data.history[i].timestamp).format('MM-DD-YYYY h:mm:ss a'));
			}

			res.render('showstock.ejs', {
				utils: { stock, company: result[0].data.company, time, curr: result[0].data.price.toFixed(2), prices, dates }
			});
		}).catch(err => console.log(err));


	});

	// LOGOUT ==============================
	app.get('/logout', function (req, res) {
		req.logout();
		res.redirect('/');
	});

	// =============================================================================
	// AUTHENTICATE (FIRST LOGIN) ==================================================
	// =============================================================================

	// locally --------------------------------
	// LOGIN ===============================
	// show the login form
	app.get('/login', function (req, res) {
		res.render('login.ejs', { message: req.flash('loginMessage') });
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
		successRedirect: '/profile', // redirect to the secure profile section
		failureRedirect: '/login', // redirect back to the signup page if there is an error
		failureFlash: true // allow flash messages
	}));

	// SIGNUP =================================
	// show the signup form
	app.get('/signup', function (req, res) {
		res.render('signup.ejs', { message: req.flash('signupMessage') });
	});

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect: '/profile', // redirect to the secure profile section
		failureRedirect: '/signup', // redirect back to the signup page if there is an error

		failureFlash: true // allow flash messages
	}));



	// =============================================================================
	// AUTHORIZE (ALREADY LOGGED IN /  =============
	// =============================================================================

	// locally --------------------------------
	app.get('/connect/local', function (req, res) {
		res.render('connect-local.ejs', { message: req.flash('loginMessage') });
	});
	app.post('/connect/local', passport.authenticate('local-signup', {
		successRedirect: '/profile', // redirect to the secure profile section
		failureRedirect: '/connect/local', // redirect back to the signup page if there is an error
		failureFlash: true // allow flash messages
	}));



	// =============================================================================
	// UNLINK ACCOUNTS =============================================================
	// =============================================================================
	// used to unlink accounts. for social accounts, just remove the token
	// for local account, remove email and password
	// user account will stay active in case they want to reconnect in the future

	// local -----------------------------------
	app.get('/unlink/local', isLoggedIn, function (req, res) {
		var user = req.user;
		user.local.email = undefined;
		user.local.password = undefined;
		user.save(function (err) {
			res.redirect('/profile');
		});
	});

	app.get('/invalid', function (req, res) {
		res.render('invalid.ejs');
	});

	app.use(function (req, res) {
		res.redirect('/invalid')
	});


};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
	if (req.isAuthenticated())
		return next();

	res.redirect('/');
}
