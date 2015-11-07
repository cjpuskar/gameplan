// A gameplan-app project
// =============================================================================

var express = require('express'); // bring in express
var bodyParser = require('body-parser'); // bring in body parser for parsing requests
var router = require('../router.js'); // connect to our router
var session = require('express-session'); // to enable user sessions
var User = require('../models/userModel.js'); // our user schema
var Site = require('../models/siteModel.js'); // our site schema
var Q = require('q'); // promises library
var moment = require('moment'); // library for dealing with dates and times


// AUTH & USER
exports.ensureAuthenticated = function(req, res, next) { // make sure user auth is valid, use this for anything that needs to be protected
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login')
};

exports.fetchUserInfoFromFB = function(req, res) { // Get User info from FB
  var fbUserInfo = {
    "fbId": res.req.user.id,
    "fbUserName": res.req.user.displayName,
    "fbPicture": res.req.user.photos[0].value,
  };

  res.cookie('facebook', fbUserInfo); // Set user info in cookies

  exports.postUserInfo(fbUserInfo);

  res.redirect('/');
};

exports.postUserInfo = function(userInfo) { // post user info to our db
  var userCreate = Q.nbind(User.findOrCreate, User);
  var newUser = {
    'user_fb_id': userInfo.fbId,
    'username': userInfo.fbUserName,
    'photo': userInfo.fbPicture
  };
  userCreate(newUser);
};


// SITES
exports.postSiteInfo = function(req, res) { // interact with db to post site's info
  var siteCreate = Q.nbind(Site.findOrCreate, Site);
  var siteFind = Q.nbind(Site.findOne, Site);
  var newSite = {
    'site_place_id': req.body.place_id,
    'sitename': req.body.name,
    'checkins': 0
  };
  siteCreate(newSite);

  siteFind({
    'site_place_id': req.body.place_id
  }, 'checkins', function(err, result) {
    if (err) {
      res.send('site lookup error: ', err);
    } else {
      res.send(result);
    }
  });
};

exports.siteCheckin = function(req, res) { //  update site checkin count and return new count
  var siteFind = Q.nbind(Site.findOne, Site);

  siteFind({
    'site_place_id': req.body.place_id
  }, 'checkins', function(err, result) {
    if (err) {
      res.send('site lookup error: ', err);
    } else {
      result.checkins++;
      result.save();
      res.send(result);
    }
  });
};

exports.siteCheckout = function(req, res) { //  update site checkin count and return new count
  var siteFind = Q.nbind(Site.findOne, Site);

  siteFind({
    'site_place_id': req.body.place_id
  }, 'checkins', function(err, result) {
    if (err) {
      res.send('site lookup error: ', err);
    } else {
      result.checkins--;
      result.save();
      res.send(result);
    }
  });
};

function addRes (req, res){
  Site.findOneAndUpdate(findQuery, 
  // add new reservation to existing site doc
  {$push: {"reservations":{
    date: moment(req.body.date, "DDMMYYYY"),
    time: req.body.time,
    user_id: req.body.user_id
  }}},
  // upsert: create if it doesn't already exist, new: return updated doc
  {upsert: true, new: true},
  function (err, result) {
    if (err) {
      console.error(err);
      res.status(400).send("error making reservation");
    }
    res.status(200).send();
  })
}

exports.siteReserve = function(req, res) {
  var findQuery = {
    'sitename': req.body.sitename,
  }
  var siteFindOne = Q.bind(Site.findOneAndUpdate, Site);

  Site.find({
    sitename: req.body.sitename, 
    "reservations.date": moment(req.body.date, "DDMMYYY"), 
    "reservations.time":req.body.time
  })
  .exec(function (err, result){
    if (result.length===0) {
      addRes(req, res);
    } else {
      res.status(202).send("there is already a reservation at that time");
    }
  });  
};



exports.siteDayAvailability = function(req, res) {
  var res_length = req.body.res_length || 1;
  var free_hours = _.range(24);
  siteFindAll = Q.bind(Site.find, Site);
  siteFindAll(findQuery, function(err, result) {
    if (err) {
      console.error(err);
    }

    _.each(result, function(reservation) {
      var i = _.indexOf(free_hours, reservation.time)
      if (i > 0) {
        free_hours.splice(i, res_length);
      }
    });
    return free_hours
  })
  res.send(free_hours);
};
