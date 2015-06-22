var mongoose = require('mongoose');
var crypto = require('crypto');
var Schema = mongoose.Schema;

// Inspiration: https://github.com/madhums/node-express-mongoose-demo/blob/master/app/models/user.js

var userSchema = new Schema({
  username: { type: String, default: '' },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  provider: { type: String, default: '' },
  hashedPassword: { type: String, default: '' },
  salt: { type: String, default: '' },
  inviteCode: { type: String, default: '' },
  // authToken: { type: String, default: '' },
  // facebook: {},
  // twitter: {},
  // google: {},

  avatar: { type: String, default: '' },
  location: { type: String, default: '' },
  tz: { type: String, default: '' },

  teams: [{ type: Schema.ObjectId, ref: 'Team' }],

  createdAt: { type : Date, default : Date.now },
  updatedAt: { type : Date, default : Date.now }
});


// Indexes
userSchema.index({ "username": 1 });
userSchema.index({ "teams": 1 });


// Keep these configs closer to the ones in static
var PUBLIC_FIELDS = [
  '_id',
  'username',
  'name',
  'avatar',
  'location',
  'tz',
  'isRegistered'
];

userSchema.set('toJSON', {
  getters: true,
  virtuals: true,
  transform: function (doc, ret, options) {
    return PUBLIC_FIELDS.reduce(function(obj, field) {
      obj[field] = ret[field];
      return obj;
    }, {});
  }
});

//TODO username validation as slug

userSchema
  .virtual('password')
  .set(function(password) {
    this._password = password;
    this.salt = this.makeSalt();
    this.hashedPassword = this.encryptPassword(password);
  })
  .get(function() { return this._password; });

userSchema
  .virtual('isRegistered')
  .get(function() { return !!this.hashedPassword; });

userSchema.pre('save', function(next) {
  if (!this.isNew) return next();

  if (!validatePresenceOf(this.password) &&
      !this.skipValidation() &&
      !this.isEmptyUser()) {
    next(new Error('Invalid password'));
  } else {
    next();
  }
});


var validatePresenceOf = function (value) {
  return value && value.length;
};

// the below 5 validations only apply if you are signing up traditionally

userSchema.path('name').validate(function (name) {
  if (this.skipValidation()) return true;
  return name.length;
}, 'Name cannot be blank');

userSchema.path('email').validate(function (email) {
  if (this.skipValidation()) return true;
  return email.length;
}, 'Email cannot be blank');

userSchema.path('email').validate(function (email) {
  if (this.skipValidation()) return true;
  var re = /.+@.+\..+/i;
  return re.test(email);
}, 'Email must be valid');

userSchema.path('email').validate(function (email, fn) {
  var User = mongoose.model('User');
  if (this.skipValidation()) fn(true);

  // Check only when it is a new user or when email field is modified
  if (this.isNew || this.isModified('email')) {
    User.find({ email: email }).exec(function (err, users) {
      fn(!err && users.length === 0);
    });
  } else fn(true);
}, 'Email already exists');

userSchema.path('username').validate(function (username) {
  if (this.skipValidation() || this.isEmptyUser()) return true;
  return username.length;
}, 'Username cannot be blank');

userSchema.path('username').validate(function (username, fn) {
  var User = mongoose.model('User');
  if (this.skipValidation() || this.isEmptyUser()) fn(true);

  // Check only when it is a new user or when username field is modified
  if (this.isNew || this.isModified('username')) {
    User.find({ username: username }).exec(function (err, users) {
      fn(!err && users.length === 0);
    });
  } else fn(true);
}, 'Username already exists');

userSchema.path('hashedPassword').validate(function (hashedPassword) {
  if (this.skipValidation() || this.isEmptyUser()) return true;
  return hashedPassword.length;
}, 'Password cannot be blank');


userSchema.methods = {

  /**
   * Authenticate - check if the passwords are the same
   *
   * @param {String} plainText
   * @return {Boolean}
   * @api public
   */

  authenticate: function (plainText) {
    return this.encryptPassword(plainText) === this.hashedPassword;
  },

  /**
   * Make salt
   *
   * @return {String}
   * @api public
   */

  makeSalt: function () {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  },

  /**
   * Encrypt password
   *
   * @param {String} password
   * @return {String}
   * @api public
   */

  encryptPassword: function (password) {
    if (!password) return '';
    try {
      return crypto
        .createHmac('sha1', this.salt)
        .update(password)
        .digest('hex');
    } catch (err) {
      return '';
    }
  },

  /**
   * Validation is not required if using OAuth
   */

  skipValidation: function() {
    return false;
    // return ~oAuthTypes.indexOf(this.provider);
  },


  isEmptyUser: function() {
    return !this.hashedPassword;
  },

  toAdminJSON: function() {
    var json = this.toJSON();
    json.email = this.email;
    return json;
  },

  isOnTeam: function(team) {
    return !!team && !!this.teams.filter(function(t) {
      return t.toString() === team._id.toString();
    }).length;
  },

  addToTeam: function(team) {
    if (!team) return false;
    this.teams.push(team);
    return true;
  },

  removeFromTeam: function(team) {
    if (!team) return false;

    this.teams = this.teams.filter(function(teamId) {
      return teamId.toString() !== team._id.toString();
    });
    return true;
  },

};

var WRITABLE_FIELDS = [
  'name',
  'avatar',
  'location',
  'tz'
];

userSchema.statics = {

  WRITABLE_FIELDS: WRITABLE_FIELDS,

  ADMIN_WRITABLE_FIELDS: WRITABLE_FIELDS.concat([
    'email'
  ]),

  findOneByUsername: function(username, done) {
    return User.findOne({ username: username }, done);
  },

  findOneByEmail: function(email, done) {
    return User.findOne({ email: email }, done);
  },

  findAllByTeam: function(teamId, done) {
    return User.find({ 'teams': teamId }, done);
  }

};


var User = module.exports = mongoose.model('User', userSchema);