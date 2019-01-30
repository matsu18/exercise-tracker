const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid');
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI, { useNewUrlParser: true })
mongoose.Promise = global.Promise;
//mongoose.set('debug', true)

// Mongo Schema
var Schema = mongoose.Schema;
var exerciseSchema = new Schema({
  _id: {
    'type': String,
    'default': shortid.generate
  },
  username: String,
  count: {type:Number, default:0},
  from: Date,
  to: Date,
  log: [{
    description: String, 
    duration: Number, 
    date: Date
  }]
  
},{ versionKey: false });


// Model
var Exercise = mongoose.model('Exercise', exerciseSchema); 

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// create a user by posting form data username to /api/exercise/new-user 
// and returned will be an object with username and _id.
app.post('/api/exercise/new-user', function(req, res) {
    var exercise = new Exercise({username:req.body.username});
         exercise.save()
            .then(doc => {
            res.json(doc);
            console.log(doc);
           })
           .catch(err => {
            res.json({'error': err});
             console.error("error: "+err);
           })
});

// add an exercise to any user by posting form data userId(_id), description, duration, and 
// optionally date to /api/exercise/add. If no date supplied it will use current date. 
// Returned will the the user object with also with the exercise fields added.
app.post('/api/exercise/add', function(req, res) {
  Exercise.findOne({'_id':req.body.userId}, function(err, user){    
     if (err) {
        throw (err);
      }
    var dateExercised;
    (!req.body.date) ? dateExercised= new Date(): dateExercised= req.body.date;
    user.log.push({description:req.body.description, duration:req.body.duration, date:dateExercised});  
    user.count++;
    user.save().then(doc => {
      res.json(doc);
      console.log("saved: "+ doc);
     })
     .catch(err => {
      res.json({'error': err});
       console.error("error: "+err);
     })
   });
});

// get an array of all users by getting api/exercise/users 
// with the same info as when creating a user.
app.get('/api/exercise/users', function(req, res) {
   Exercise.find({}, function(err, users){
     if (err) {
        throw (err);
      }
      res.json(users);
   });
});

// retrieve a full exercise log of any user by getting /api/exercise/log 
// with a parameter of userId(_id). Return will be the user object with 
// added array log and count (total exercise count).
// Also, retrieve part of the log of any user by also passing along optional 
// parameters of from & to or limit. (Date format yyyy-mm-dd, limit = int)
app.get('/api/exercise/log', function(req, res, next) {

  Exercise.findOne({'_id':req.query.userId})
  .select('-__v -log._id')
  .exec(function(err, user){    
     if (err) {
        return next(err);
      } 
    
    var fromDate;
    var toDate;
    var limit;
    
    (validateDateValue(req.query.from)) ? fromDate = new Date(req.query.from) : fromDate = 0;
    (validateDateValue(req.query.to)) ? toDate = new Date(req.query.to) : toDate = Number.POSITIVE_INFINITY;
    (validateLimitValue(req.query.limit)) ? limit = req.query.limit : limit = Number.POSITIVE_INFINITY;
    
    var filtered = user.log.filter(function(el, index, arr){
       return el.date >= fromDate && el.date <= toDate && index <= limit -1;
    });
    
    user.count = filtered.length;

    user.log = filtered;
    user.from = req.query.from;
    user.to = req.query.to;
  
    let replacer = ["_id", "username" , "from", "to", "count", "log", "description", "duration", "date" ];
    
    res.json(JSON.parse(JSON.stringify(user, replacer)));
    
  });

});
// https://matsu-exercise-tracker.glitch.me/api/exercise/log?userId=CwtYMvHAA&from=1970-03-01&to=1999-03-09&limit=10

// limit must be non zero positive number
function validateLimitValue (limit) {
   var regex = /^[1-9]+\d*$/s;
   return regex.test(limit);
}

// yyyy-mm-dd, yyyy-mm, yyyy
function validateDateValue (date) {
   var regex = /^\d{4}-?(\d{1,2})?-?(\d{1,2})?$/;
   return regex.test(date);
}

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
