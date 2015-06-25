var EventEmitter = require('events').EventEmitter;
var cicada = require('strong-fork-cicada');
var cicadaCommit = require('strong-fork-cicada/lib/commit');
var debug = require('debug');
var util = require('util');
var packReceiver = require('./lib/pack-receiver');
var localReceiver = require('./lib/local-receiver');

function DeployReceiver(options) {
  EventEmitter.call(this);

  this._git = cicada(options.baseDir);
  this._git.on('commit', this.emit.bind(this, 'commit'));
  this._git.on('error', this.emit.bind(this, 'error'));

  this._allowLocalDeploy = options.allowLocalDeploy;
}
util.inherits(DeployReceiver, EventEmitter);

function handle(req, res) {
  if (req.method === 'PUT') {
    debug('deploy accepted: npm package');
    var tar = packReceiver(this._git);
    return tar.handle(req, res);
  }

  var contentType = req.headers['content-type'];
  if (this._allowLocalDeploy && contentType === 'application/x-pm-deploy') {
    debug('deploy accepted: local deploy');
    var local = localReceiver(this._git);
    return local.handle(req, res);
  }

  debug('deploy accepted: git deploy');
  return this._git.handle(req, res);
}
DeployReceiver.prototype.handle = handle;

function getWorkDir(commit) {
  return this._git.workdir(commit);
}
DeployReceiver.prototype.getWorkDir = getWorkDir;

function buildCommit(commitOpts) {
  return cicadaCommit(commitOpts);
}
DeployReceiver.prototype.buildCommit = buildCommit;

module.exports = DeployReceiver;

