var React  = require('react');
var moment = require('moment-timezone');
require('whatwg-fetch');
var transform = require('../utils/transform.js');
var timeUtils = require('../utils/time.js');
var clone = require('../utils/clone.js');
var AppDispatcher = require('../dispatchers/appDispatcher.js');
var ActionTypes = require('../actions/actionTypes.js');
var Team = React.createFactory(require('../views/team.jsx'));


// Application state:
var appState = clone(window.appData);

appState.time = moment(appState.time);
appState.timezones = transform(moment(appState.time), appState.people);


// Add the component to the DOM
var targetNode = document.querySelector('#page');

function renderApp() {
  React.render(Team(appState), targetNode);
}

renderApp();

// Allow arrow keys to change time by selecting time range input
var KEY = {
  LEFT:  37,
  RIGHT: 39
};
var timeSlider = document.querySelector('.time-slider');

window.addEventListener('keyup', function(e){

  if (e.keyCode === KEY.RIGHT || e.keyCode === KEY.LEFT) {
    e.preventDefault();
    disableAutoUpdate();
    timeSlider.focus();
    renderApp();
  }

});

function updateToCurrentTime() {
  var now = moment();
  if (now.hour() === appState.time.hour() && now.minute() === appState.time.minute()) return;

  appState.time.hour( now.hour() );
  appState.time.minute( now.minute() );
  appState.isCurrentTime = true;

  renderApp();
}

// 0 is now, 1.0 is in 12 hours, -1.0 is 12 hours ago
function updateTimeAsPercent(percentDelta) {

  if (percentDelta === 0) {
    enableAutoUpdate();
    return updateToCurrentTime();
  }

  var MIN_IN_12_HOURS = 720;
  var deltaMinutes = MIN_IN_12_HOURS * percentDelta;

  var now = moment();
  now.add(deltaMinutes, 'm');

  // Round to quarter hour
  var minutes = now.minutes();
  now.add(timeUtils.roundToQuarterHour(minutes) - minutes, 'm');

  appState.time = now;
  appState.isCurrentTime = false;

  renderApp();
}


function json(res) {
  return res.json();
}
function saveTeamInfo(info) {

  info._csrf = appState.csrf_token;

  var options = {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify(info)
  };

  return fetch('/api/team/' + appState.team._id, options)
    .then(json)
    .then(function(res){
      console.info(res);
      return res;
    });
}

function updateCurrentView(view, shouldUpdateUrl) {
  appState.currentView = view;

  if (shouldUpdateUrl) {
    var path = appState.team.url;

    if (view !== 'app')
      path += '/' + view;

    window.history.pushState({}, null, path);
  }

  renderApp();
}

function handlePopState(e) {
  var path = window.location.pathname;
  var segment = path.replace(appState.team.url, '');
  var view = segment.length ? segment.substr(1) : 'app';
  updateCurrentView(view);
}


window.addEventListener('popstate', handlePopState);

AppDispatcher.register(function(payload) {

  // console.info('EVENT: ', payload);

  var actionType = payload.action.actionType;
  var value = payload.action.value;

  switch (actionType) {

    case ActionTypes.CHANGE_TIME_FORMAT:
      appState.timeFormat = value;
      renderApp();
      break;
    case ActionTypes.USE_CURRENT_TIME:
      updateToCurrentTime();
      enableAutoUpdate();
      break;
    case ActionTypes.ADJUST_TIME_DISPLAY:
      disableAutoUpdate();
      updateTimeAsPercent(value);
      break;

    case ActionTypes.CLOSE_MODAL:
      updateCurrentView('app', true);
      break;
    case ActionTypes.SHOW_MODAL:
      updateCurrentView(value, true);
      break;

    case ActionTypes.SAVE_TEAM_INFO:
      saveTeamInfo(value);
      break;

  }

});



// Auto updating the time

var autoUpdateIntervalId = null;
function enableAutoUpdate() {

  // Check every 20 seconds for an updated time
  autoUpdateIntervalId = setInterval(updateToCurrentTime, 1000 * 20);

  // Check on window focus
  window.onfocus = updateToCurrentTime;
}

function disableAutoUpdate() {
  clearInterval(autoUpdateIntervalId);
  window.onfocus = null;
}

enableAutoUpdate();
